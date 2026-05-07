use crate::{parse, serialize, validate, EmdIndex, SectionType, SectionStatus};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_lsp::jsonrpc::Result as LspResult;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

struct Backend {
    client: Client,
    index: Arc<RwLock<EmdIndex>>,
    workspace_root: Arc<RwLock<Option<String>>>,
    open_files: Arc<RwLock<HashMap<Url, String>>>,
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, params: InitializeParams) -> LspResult<InitializeResult> {
        if let Some(workspace_folders) = params.workspace_folders {
            if let Some(folder) = workspace_folders.first() {
                if let Ok(path) = folder.uri.to_file_path() {
                    *self.workspace_root.write().await = Some(path.to_string_lossy().to_string());
                    self.refresh_index().await;
                }
            }
        } else if let Some(root) = params.root_uri {
            if let Ok(path) = root.to_file_path() {
                *self.workspace_root.write().await = Some(path.to_string_lossy().to_string());
                self.refresh_index().await;
            }
        }

        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                hover_provider: Some(HoverProviderCapability::Simple(true)),
                definition_provider: Some(OneOf::Left(true)),
                completion_provider: Some(CompletionOptions {
                    trigger_characters: Some(vec![
                        "[".to_string(),
                        "|".to_string(),
                        "\u{2192}".to_string(),
                        " ".to_string(),
                    ]),
                    ..CompletionOptions::default()
                }),
                document_formatting_provider: Some(OneOf::Left(true)),
                code_action_provider: Some(CodeActionProviderCapability::Simple(true)),
                document_symbol_provider: Some(OneOf::Left(true)),
                workspace_symbol_provider: Some(OneOf::Left(true)),
                ..ServerCapabilities::default()
            },
            server_info: Some(ServerInfo {
                name: "emd-lsp".to_string(),
                version: Some("0.1.0".to_string()),
            }),
            ..InitializeResult::default()
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "EMD LSP server initialized")
            .await;
    }

    async fn shutdown(&self) -> LspResult<()> {
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let url = params.text_document.uri.clone();
        self.open_files
            .write()
            .await
            .insert(url.clone(), params.text_document.text.clone());
        self.publish_diagnostics(url).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let url = params.text_document.uri.clone();
        if let Some(change) = params.content_changes.into_iter().last() {
            self.open_files
                .write()
                .await
                .insert(url.clone(), change.text);
        }
        self.publish_diagnostics(url).await;
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        self.open_files.write().await.remove(&params.text_document.uri);
    }

    async fn hover(&self, params: HoverParams) -> LspResult<Option<Hover>> {
        let uri = params.text_document_position_params.text_document.uri;
        let pos = params.text_document_position_params.position;
        let files = self.open_files.read().await;
        let content = match files.get(&uri) {
            Some(c) => c,
            None => return Ok(None),
        };

        let line_idx = pos.line as usize;
        let lines: Vec<&str> = content.lines().collect();

        if line_idx >= lines.len() {
            return Ok(None);
        }

        let line = lines[line_idx];

        if let Some(section_info) = detect_section_at_cursor(content, pos.line as usize) {
            let details = format!(
                "**Type:** {}\n**Status:** {}\n**Level:** H{}",
                section_info.section_type.as_str(),
                section_info.status.map(|s| s.as_str()).unwrap_or_else(|| "none".to_string()),
                section_info.level,
            );

            return Ok(Some(Hover {
                contents: HoverContents::Markup(MarkupContent {
                    kind: MarkupKind::Markdown,
                    value: details,
                }),
                range: None,
            }));
        }

        if line.contains('\u{2192}') {
            let relation_info = extract_link_relation(line);
            if !relation_info.is_empty() {
                return Ok(Some(Hover {
                    contents: HoverContents::Markup(MarkupContent {
                        kind: MarkupKind::Markdown,
                        value: relation_info,
                    }),
                    range: None,
                }));
            }
        }

        Ok(None)
    }

    async fn goto_definition(
        &self,
        params: GotoDefinitionParams,
    ) -> LspResult<Option<GotoDefinitionResponse>> {
        let uri = params.text_document_position_params.text_document.uri;
        let pos = params.text_document_position_params.position;
        let files = self.open_files.read().await;
        let content = match files.get(&uri) {
            Some(c) => c,
            None => return Ok(None),
        };

        let line_idx = pos.line as usize;
        let lines: Vec<&str> = content.lines().collect();

        if line_idx >= lines.len() {
            return Ok(None);
        }

        let line = lines[line_idx];

        let wl_re = regex::Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
        if let Some(caps) = wl_re.captures(line) {
            let full_target = caps.get(1).unwrap().as_str();
            let (file_name, _anchor) = if let Some((f, a)) = full_target.split_once('#') {
                (f, a)
            } else {
                (full_target, "")
            };

            let root = self.workspace_root.read().await;
            if let Some(ref root_path) = *root {
                let target_path = std::path::Path::new(root_path).join(file_name);
                if target_path.exists() {
                    if let Ok(target_uri) = Url::from_file_path(&target_path) {
                        return Ok(Some(GotoDefinitionResponse::Scalar(Location {
                            uri: target_uri,
                            range: Range::new(Position::new(0, 0), Position::new(0, 0)),
                        })));
                    }
                }
            }
        }

        Ok(None)
    }

    async fn completion(&self, params: CompletionParams) -> LspResult<Option<CompletionResponse>> {
        let uri = params.text_document_position.text_document.uri;
        let pos = params.text_document_position.position;
        let files = self.open_files.read().await;
        let content = match files.get(&uri) {
            Some(c) => c,
            None => return Ok(None),
        };

        let line_idx = pos.line as usize;
        let current_line = content.lines().nth(line_idx).unwrap_or("");

        let mut items = Vec::new();

        if current_line.contains("## [") {
            let types = [
                "summary", "detail", "task", "decision", "api", "spec",
                "agent", "human", "verify", "config", "graph", "draw",
                "flow", "kanban", "template", "example",
            ];
            for t in &types {
                items.push(CompletionItem {
                    label: t.to_string(),
                    kind: Some(CompletionItemKind::KEYWORD),
                    detail: Some("Section type".to_string()),
                    insert_text: Some(format!("[{}] ", t)),
                    ..CompletionItem::default()
                });
            }
        }

        if current_line.contains('|') && current_line.contains("## [") {
            let statuses = ["done", "pending", "in-progress", "blocked:", "archived", "cancelled"];
            for s in &statuses {
                items.push(CompletionItem {
                    label: s.to_string(),
                    kind: Some(CompletionItemKind::ENUM),
                    detail: Some("Section status".to_string()),
                    insert_text: Some(format!("{}]", s)),
                    ..CompletionItem::default()
                });
            }
        }

        if current_line.contains('\u{2192}') || current_line.trim().starts_with('\u{2192}') {
            let relations = [
                "depends", "implements", "tested-by", "supersedes", "compatible-with",
                "alternative-to", "extends", "blocked-by", "param", "returns", "errors",
                "model", "tools", "memory", "context", "persona", "node", "edge",
                "entry", "max-iterations", "timeout", "store-in", "recall-from", "compress-after",
            ];
            for r in &relations {
                items.push(CompletionItem {
                    label: r.to_string(),
                    kind: Some(CompletionItemKind::PROPERTY),
                    detail: Some("Link relation".to_string()),
                    insert_text: Some(format!(" {}: ", r)),
                    ..CompletionItem::default()
                });
            }
        }

        Ok(Some(CompletionResponse::Array(items)))
    }

    async fn formatting(&self, params: DocumentFormattingParams) -> LspResult<Option<Vec<TextEdit>>> {
        let uri = params.text_document.uri;
        let files = self.open_files.read().await;
        let content = match files.get(&uri) {
            Some(c) => c,
            None => return Ok(None),
        };

        let doc = parse(content);
        let formatted = serialize(&doc);

        if *content != formatted {
            let line_count = content.lines().count() as u32;
            Ok(Some(vec![TextEdit {
                range: Range::new(Position::new(0, 0), Position::new(line_count, 0)),
                new_text: formatted,
            }]))
        } else {
            Ok(None)
        }
    }

    async fn code_action(&self, params: CodeActionParams) -> LspResult<Option<CodeActionResponse>> {
        let diagnostic = match params.context.diagnostics.first() {
            Some(d) => d,
            None => return Ok(None),
        };

        let mut actions = Vec::new();

        if diagnostic.message.contains("EMD001") {
            actions.push(CodeActionOrCommand::CodeAction(CodeAction {
                title: "Remove unknown section type".to_string(),
                kind: Some(CodeActionKind::QUICKFIX),
                edit: Some(WorkspaceEdit {
                    changes: Some(HashMap::from([(
                        params.text_document.uri.clone(),
                        vec![TextEdit {
                            range: diagnostic.range,
                            new_text: String::new(),
                        }],
                    )])),
                    ..WorkspaceEdit::default()
                }),
                ..CodeAction::default()
            }));
        }

        if diagnostic.message.contains("EMD300") || diagnostic.message.contains("pending") {
            actions.push(CodeActionOrCommand::CodeAction(CodeAction {
                title: "Mark as done".to_string(),
                kind: Some(CodeActionKind::QUICKFIX),
                diagnostics: Some(vec![diagnostic.clone()]),
                edit: Some(WorkspaceEdit {
                    changes: Some(HashMap::from([(
                        params.text_document.uri.clone(),
                        vec![TextEdit {
                            range: diagnostic.range,
                            new_text: "[done]".to_string(),
                        }],
                    )])),
                    ..WorkspaceEdit::default()
                }),
                ..CodeAction::default()
            }));
        }

        Ok(Some(actions))
    }

    async fn document_symbol(
        &self,
        params: DocumentSymbolParams,
    ) -> LspResult<Option<DocumentSymbolResponse>> {
        #[allow(deprecated)]
        let uri = params.text_document.uri;
        let files = self.open_files.read().await;
        let content = match files.get(&uri) {
            Some(c) => c,
            None => return Ok(None),
        };

        let doc = parse(content);
        let mut symbols = Vec::new();

        for section in &doc.sections {
            let symbol = DocumentSymbol {
                name: format!(
                    "[{}] {}",
                    section.section_type.as_str(),
                    section.title
                ),
                detail: section.status.as_ref().map(|s| s.as_str()),
                kind: SymbolKind::STRUCT,
                range: Range::new(
                    Position::new(section.source_span.start_line.saturating_sub(1) as u32, 0),
                    Position::new(section.source_span.start_line.saturating_sub(1) as u32 + 1, 0),
                ),
                selection_range: Range::new(
                    Position::new(section.source_span.start_line.saturating_sub(1) as u32, 0),
                    Position::new(section.source_span.start_line.saturating_sub(1) as u32, 0),
                ),
                children: None,
                tags: None,
                deprecated: None,
            };
            symbols.push(symbol);
        }

        Ok(Some(DocumentSymbolResponse::Nested(Vec::new())))
    }

    async fn symbol(
        &self,
        params: WorkspaceSymbolParams,
    ) -> LspResult<Option<Vec<SymbolInformation>>> {
        let query = params.query.to_lowercase();
        let mut symbols = Vec::new();

        for (file, sections) in &self.index.read().await.files {
            for section in sections {
                if section.title.to_lowercase().contains(&query)
                    || section.section_type.as_str().to_lowercase().contains(&query)
                {
                    if let Ok(uri) = Url::parse(&format!("file:///{}", file.replace('\\', "/"))) {
                        #[allow(deprecated)]
                        symbols.push(SymbolInformation {
                            name: section.title.clone(),
                            kind: SymbolKind::STRUCT,
                            location: Location {
                                uri,
                                range: Range::new(
                                    Position::new(section.source_line as u32, 0),
                                    Position::new(section.source_line as u32, 0),
                                ),
                            },
                            container_name: Some(file.clone()),
                            deprecated: None,
                            tags: None,
                        });
                    }
                }
            }
        }

        Ok(Some(symbols))
    }
}

impl Backend {
    fn new(client: Client) -> Self {
        Backend {
            client,
            index: Arc::new(RwLock::new(EmdIndex::new())),
            workspace_root: Arc::new(RwLock::new(None)),
            open_files: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn refresh_index(&self) {
        let root = self.workspace_root.read().await;
        if let Some(ref root_path) = *root {
            let path = std::path::Path::new(root_path);
            if let Ok(new_index) = EmdIndex::build_from_dir(path) {
                *self.index.write().await = new_index;
            }
        }
    }

    async fn publish_diagnostics(&self, uri: Url) {
        let files = self.open_files.read().await;
        let content = match files.get(&uri) {
            Some(c) => c,
            None => return,
        };

        let doc = parse(content);
        let index = self.index.read().await;
        let all_diags = validate(&doc, &index, false);

        let diagnostics: Vec<Diagnostic> = all_diags
            .iter()
            .map(|d| {
                let severity = match d.severity {
                    crate::DiagnosticSeverity::Error => Some(DiagnosticSeverity::ERROR),
                    crate::DiagnosticSeverity::Warning => Some(DiagnosticSeverity::WARNING),
                    crate::DiagnosticSeverity::Info => Some(DiagnosticSeverity::INFORMATION),
                    crate::DiagnosticSeverity::Hint => Some(DiagnosticSeverity::HINT),
                };
                let range = d
                    .source_span
                    .as_ref()
                    .map(|s| Range::new(
                        Position::new(s.start_line.saturating_sub(1) as u32, 0),
                        Position::new(s.end_line.saturating_sub(1) as u32, 0),
                    ))
                    .unwrap_or(Range::new(Position::new(0, 0), Position::new(0, 0)));

                Diagnostic {
                    range,
                    severity,
                    code: d.code.as_ref().map(|c| NumberOrString::String(c.clone())),
                    source: Some("emd".to_string()),
                    message: d.message.clone(),
                    ..Diagnostic::default()
                }
            })
            .collect();

        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }
}

struct SectionInfo {
    section_type: SectionType,
    status: Option<SectionStatus>,
    level: u8,
}

fn detect_section_at_cursor(content: &str, line_number: usize) -> Option<SectionInfo> {
    let lines: Vec<&str> = content.lines().collect();
    let mut current_line = line_number;

    loop {
        if current_line >= lines.len() {
            return None;
        }
        let line = lines[current_line];
        if line.trim_start().starts_with('#') {
            let re = regex::Regex::new(r"^#+\s+\[([a-zA-Z_-]+)(?:\|([^\]]+))?\]\s*(.*)").unwrap();
            if let Some(caps) = re.captures(line.trim_start()) {
                let section_type = SectionType::from_str(&caps[1]);
                let status = caps.get(2).map(|m| SectionStatus::from_str(m.as_str()));
                let level = line.chars().take_while(|c| *c == '#').count() as u8;
                return Some(SectionInfo {
                    section_type,
                    status,
                    level,
                });
            }
            return None;
        }
        if current_line == 0 {
            return None;
        }
        current_line -= 1;
    }
}

fn extract_link_relation(line: &str) -> String {
    let re = regex::Regex::new(r"\u{2192}\s*([a-zA-Z-]+)\s*:\s*(.+)").unwrap();
    if let Some(caps) = re.captures(line) {
        let relation_str = &caps[1];
        let target = &caps[2];
        return format!(
            "**Relation:** {}\n**Target:** {}\n**Connection:** {} \u{2192} {}",
            relation_str,
            target.trim(),
            relation_str,
            target.trim(),
        );
    }
    String::new()
}

pub async fn start_lsp_server() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(Backend::new);
    Server::new(stdin, stdout, socket).serve(service).await;
}
