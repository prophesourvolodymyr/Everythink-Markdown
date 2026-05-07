use crate::types::*;
use regex::Regex;

pub fn parse(source: &str) -> EmdDocument {
    let mut diagnostics = Vec::new();
    let sections = parse_sections(source, 1, &mut diagnostics);

    let metadata = DocumentMetadata {
        title: None,
        version: None,
        owner: None,
    };

    EmdDocument {
        sections,
        diagnostics,
        metadata,
    }
}

fn parse_sections(source: &str, _base_level: u8, diagnostics: &mut Vec<Diagnostic>) -> Vec<Section> {
    let mut sections = Vec::new();
    let heading_re = Regex::new(r"(?m)^(#{1,6})\s+(.+)$").unwrap();
    let header_re = Regex::new(r"^\[([a-zA-Z_-]+)(?:\|([^\]]+))?\]\s*(.*)$").unwrap();

    #[derive(Clone)]
    struct RawSection {
        level: u8,
        heading_text: String,
        body_start: usize,
        match_start: usize,
        source_line: usize,
    }

    let mut raw_sections: Vec<RawSection> = Vec::new();

    for caps in heading_re.captures_iter(source) {
        let full_match = caps.get(0).unwrap();
        let heading_level = caps.get(1).unwrap().as_str().len() as u8;
        let heading_text = caps.get(2).unwrap().as_str().to_string();
        let match_start = full_match.start();
        let match_end = full_match.end();

        let source_line = count_lines(&source[..match_start]) + 1;

        raw_sections.push(RawSection {
            level: heading_level,
            heading_text,
            body_start: match_end,
            match_start,
            source_line,
        });
    }

    for i in 0..raw_sections.len() {
        let raw = &raw_sections[i];

        let (section_type, status, title) = parse_section_header(&raw.heading_text, &header_re, diagnostics);

        let body_start = source[raw.body_start..]
            .find('\n')
            .map(|n| raw.body_start + n + 1)
            .unwrap_or(raw.body_start);

        let body_end_actual = raw_sections.get(i + 1)
            .map(|next| next.match_start)
            .unwrap_or(source.len());

        let body = if body_end_actual > body_start {
            source[body_start..body_end_actual]
                .trim_end_matches(|c: char| c == '\n')
                .to_string()
        } else {
            String::new()
        };

        let content = parse_section_body(&body, &section_type, diagnostics, raw.source_line + 1);
        let subsections = parse_sections(&body, raw.level + 1, diagnostics);

        sections.push(Section {
            level: raw.level,
            section_type,
            status,
            title,
            content,
            subsections,
            source_span: SourceSpan::new(raw.source_line, 0, raw.source_line, 0),
            diagnostics: Vec::new(),
            metadata: SectionMetadata::default(),
        });
    }

    if sections.is_empty() && !source.trim().is_empty() && _base_level == 1 {
        sections.push(Section {
            level: 1,
            section_type: SectionType::Unknown,
            status: None,
            title: "Untitled".to_string(),
            content: vec![SectionElement::Text(source.to_string())],
            subsections: Vec::new(),
            source_span: SourceSpan::empty(),
            diagnostics: Vec::new(),
            metadata: SectionMetadata::default(),
        });
    }

    sections
}

fn parse_section_header(
    text: &str,
    re: &Regex,
    diagnostics: &mut Vec<Diagnostic>,
) -> (SectionType, Option<SectionStatus>, String) {
    if let Some(caps) = re.captures(text) {
        let type_str = caps.get(1).unwrap().as_str();
        let status_str = caps.get(2).map(|m| m.as_str());
        let title = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_default();

        let section_type = SectionType::from_str(type_str);
        let status = status_str.map(SectionStatus::from_str);

        if section_type == SectionType::Unknown {
            diagnostics.push(
                Diagnostic::warning(format!("Unknown section type: '{}'", type_str))
                    .with_code("EMD001"),
            );
        }

        (section_type, status, title)
    } else {
        (SectionType::Unknown, None, text.to_string())
    }
}

fn parse_section_body(
    body: &str,
    _section_type: &SectionType,
    diagnostics: &mut Vec<Diagnostic>,
    base_line: usize,
) -> Vec<SectionElement> {
    let mut elements = Vec::new();
    let mut in_code_fence = false;
    let mut code_content = String::new();
    let mut code_tag: Option<CodeBlockTag> = None;
    let mut code_lang: Option<String> = None;
    let mut code_start_line = 0;
    let mut text_buffer = String::new();

    for (line_num, line) in body.lines().enumerate() {
        let abs_line = base_line + line_num + 1;

        if in_code_fence {
            if line.trim() == "```" {
                in_code_fence = false;
                flush_text_buffer(&mut text_buffer, &mut elements);

                let content_trimmed = if code_content.ends_with('\n') {
                    code_content[..code_content.len() - 1].to_string()
                } else {
                    code_content.clone()
                };

                elements.push(SectionElement::CodeBlock(CodeBlock {
                    tag: code_tag.take(),
                    language: code_lang.take(),
                    content: content_trimmed,
                    source_span: SourceSpan::new(code_start_line, 0, abs_line, 3),
                }));
                code_content.clear();
            } else {
                code_content.push_str(line);
                code_content.push('\n');
            }
            continue;
        }

        let trimmed = line.trim();

        if trimmed.starts_with("```") && !trimmed.starts_with("````") {
            in_code_fence = true;
            code_start_line = abs_line;
            code_tag = parse_code_block_tag(trimmed);
            code_lang = parse_code_block_lang(trimmed);
            flush_text_buffer(&mut text_buffer, &mut elements);
            continue;
        }

        if let Some(link) = try_parse_semantic_link(trimmed, abs_line, diagnostics) {
            flush_text_buffer(&mut text_buffer, &mut elements);
            elements.push(SectionElement::Link(link));
            continue;
        }

        if let Some(wl) = try_parse_wiki_link_inline(trimmed) {
            for elem in convert_line_to_elements(trimmed, abs_line, &wl) {
                elements.push(elem);
            }
            flush_text_buffer(&mut text_buffer, &mut elements);
            continue;
        }

        if let Some(tc) = try_parse_transclusion_inline(trimmed) {
            for elem in convert_line_to_elements(trimmed, abs_line, &tc) {
                elements.push(elem);
            }
            flush_text_buffer(&mut text_buffer, &mut elements);
            continue;
        }

        if let Some(mc) = try_parse_metadata_comment(trimmed, abs_line) {
            flush_text_buffer(&mut text_buffer, &mut elements);
            elements.push(SectionElement::MetadataComment(mc));
            continue;
        }

        if !text_buffer.is_empty() {
            text_buffer.push('\n');
        }
        text_buffer.push_str(line);
    }

    flush_text_buffer(&mut text_buffer, &mut elements);

    if in_code_fence {
        diagnostics.push(
            Diagnostic::warning("Unclosed code fence — assumed closed at end of file")
                .with_span(SourceSpan::new(code_start_line, 0, code_start_line, 0))
                .with_code("EMD002"),
        );

        let content_trimmed = if code_content.ends_with('\n') {
            code_content[..code_content.len() - 1].to_string()
        } else {
            code_content.clone()
        };

        elements.push(SectionElement::CodeBlock(CodeBlock {
            tag: code_tag,
            language: code_lang,
            content: content_trimmed,
            source_span: SourceSpan::new(code_start_line, 0, code_start_line + 1, 0),
        }));
    }

    elements
}

fn convert_line_to_elements(line: &str, _line_num: usize, _match_item: &dyn std::fmt::Debug) -> Vec<SectionElement> {
    let mut elems = Vec::new();

    let wl_re = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    let tc_re = Regex::new(r"!\[\[([^\]]+)\]\]").unwrap();

    let mut last_end = 0;

    #[derive(Debug)]
    enum Found {
        Wiki(usize, usize, String, Option<String>),
        Trans(usize, usize, String, Option<String>),
    }

    let mut finds: Vec<Found> = Vec::new();

    for caps in tc_re.captures_iter(line) {
        let m = caps.get(0).unwrap();
        let full_target = caps.get(1).unwrap().as_str();
        let (target, anchor) = if let Some((f, a)) = full_target.split_once('#') {
            (f.to_string(), Some(a.trim().to_string()))
        } else {
            (full_target.to_string(), None)
        };
        finds.push(Found::Trans(m.start(), m.end(), target, anchor));
    }

    for caps in wl_re.captures_iter(line) {
        let m = caps.get(0).unwrap();
        let is_transclusion = m.start() > 0 && line.as_bytes().get(m.start() - 1) == Some(&b'!');
        if is_transclusion {
            continue;
        }
        let full_target = caps.get(1).unwrap().as_str();
        let (target, anchor) = if let Some((f, a)) = full_target.split_once('#') {
            (f.to_string(), Some(a.trim().to_string()))
        } else {
            (full_target.to_string(), None)
        };
        finds.push(Found::Wiki(m.start(), m.end(), target, anchor));
    }

    finds.sort_by_key(|f| match f {
        Found::Wiki(s, _, _, _) => *s,
        Found::Trans(s, _, _, _) => *s,
    });

    for f in &finds {
        let (start, end) = match f {
            Found::Wiki(s, e, _, _) => (*s, *e),
            Found::Trans(s, e, _, _) => (*s, *e),
        };

        if start > last_end {
            let text = line[last_end..start].to_string();
            if !text.trim().is_empty() || start == 0 {
                elems.push(SectionElement::Text(text));
            }
        }

        match f {
            Found::Wiki(_, _, target, anchor) => {
                elems.push(SectionElement::WikiLink(WikiLink {
                    target: target.clone(),
                    anchor: anchor.clone(),
                    source_span: SourceSpan::empty(),
                }));
            }
            Found::Trans(_, _, target, anchor) => {
                elems.push(SectionElement::Transclusion(Transclusion {
                    target: target.clone(),
                    anchor: anchor.clone(),
                    source_span: SourceSpan::empty(),
                    resolved_content: None,
                }));
            }
        }

        last_end = end;
    }

    if last_end < line.len() {
        let text = line[last_end..].to_string();
        if !text.trim().is_empty() || elems.is_empty() {
            elems.push(SectionElement::Text(text));
        }
    }

    elems
}

fn flush_text_buffer(buffer: &mut String, elements: &mut Vec<SectionElement>) {
    let text = buffer.trim().to_string();
    buffer.clear();
    if !text.is_empty() {
        elements.push(SectionElement::Text(text));
    }
}

fn parse_code_block_tag(info: &str) -> Option<CodeBlockTag> {
    let info = info.trim_start_matches("```").trim();
    let tag_re = Regex::new(r"\[([a-zA-Z0-9_-]+)\]").unwrap();
    if let Some(caps) = tag_re.captures(info) {
        CodeBlockTag::from_str(caps.get(1).unwrap().as_str())
    } else {
        None
    }
}

fn parse_code_block_lang(info: &str) -> Option<String> {
    let info = info.trim_start_matches("```").trim();
    let re = Regex::new(r"^([a-zA-Z0-9_+#]+)").unwrap();
    if let Some(caps) = re.captures(info) {
        let lang = caps.get(1).unwrap().as_str();
        if CodeBlockTag::from_str(lang).is_some() {
            Some(lang.to_string())
        } else if !lang.is_empty() {
            Some(lang.to_string())
        } else {
            None
        }
    } else {
        None
    }
}

fn try_parse_semantic_link(
    line: &str,
    _line_num: usize,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<SemanticLink> {
    let mut chars = line.chars().peekable();

    if chars.next()? != '\u{2192}' {
        return None;
    }

    let remaining: String = chars.collect();
    let remaining = remaining.trim();

    let (relation_str, rest) = remaining.split_once(':')?;

    let relation = LinkRelation::from_str(relation_str.trim());

    let rest = rest.trim_start();
    let (target, condition) = if let Some(cond_start) = rest.find(" [condition:") {
        let t = rest[..cond_start].trim().to_string();
        let cond_part = &rest[cond_start..];
        let cond_re = Regex::new(r"\[condition:\s*(.+?)]").unwrap();
        let c = cond_re.captures(cond_part).map(|caps| caps.get(1).unwrap().as_str().to_string());
        (t, c)
    } else {
        (rest.trim().to_string(), None)
    };

    if target.is_empty() {
        diagnostics.push(Diagnostic::warning(
            format!("Empty target for link relation '{}'", relation.as_str()),
        ));
        return None;
    }

    Some(SemanticLink {
        relation,
        target,
        condition,
        source_span: SourceSpan::empty(),
    })
}

fn try_parse_wiki_link_inline(line: &str) -> Option<(String, String)> {
    let re = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    let caps = re.captures(line)?;
    if caps.get(0).unwrap().start() > 0 && line.as_bytes().get(caps.get(0).unwrap().start() - 1) == Some(&b'!') {
        return None;
    }
    let full_target = caps.get(1).unwrap().as_str();

    let (target, anchor) = if let Some((file, anchor)) = full_target.split_once('#') {
        (file.to_string(), anchor.trim().to_string())
    } else {
        (full_target.to_string(), String::new())
    };

    Some((target, anchor))
}

fn try_parse_transclusion_inline(line: &str) -> Option<(String, String)> {
    let re = Regex::new(r"!\[\[([^\]]+)\]\]").unwrap();
    let caps = re.captures(line)?;
    let full_target = caps.get(1).unwrap().as_str();

    let (target, anchor) = if let Some((file, anchor)) = full_target.split_once('#') {
        (file.to_string(), anchor.trim().to_string())
    } else {
        (full_target.to_string(), String::new())
    };

    Some((target, anchor))
}

fn try_parse_metadata_comment(line: &str, _line_num: usize) -> Option<MetadataComment> {
    let re = Regex::new(r"<!--\s*([A-Z_]+):\s*(.+?)\s*-->").unwrap();
    let caps = re.captures(line)?;

    Some(MetadataComment {
        key: caps.get(1).unwrap().as_str().to_string(),
        value: caps.get(2).unwrap().as_str().to_string(),
        source_span: SourceSpan::empty(),
    })
}

fn count_lines(s: &str) -> usize {
    s.bytes().filter(|&b| b == b'\n').count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_task() {
        let source = "## [task|pending] Hello World\n\nSome text content";
        let doc = parse(source);
        assert_eq!(doc.sections.len(), 1);
        assert_eq!(doc.sections[0].section_type, SectionType::Task);
        assert_eq!(doc.sections[0].title, "Hello World");
        assert!(matches!(doc.sections[0].status, Some(SectionStatus::Pending)));
    }

    #[test]
    fn test_parse_done_task() {
        let source = "## [task|done] Hello";
        let doc = parse(source);
        assert_eq!(doc.sections.len(), 1);
        assert_eq!(doc.sections[0].section_type, SectionType::Task);
        assert!(matches!(doc.sections[0].status, Some(SectionStatus::Done)));
    }

    #[test]
    fn test_parse_all_section_types() {
        let types = [
            "summary", "detail", "task", "decision", "api", "spec",
            "agent", "human", "verify", "config", "graph", "draw",
            "flow", "kanban", "template", "example",
        ];
        for t in &types {
            let source = format!("## [{}] Test Title", t);
            let doc = parse(&source);
            assert_eq!(doc.sections.len(), 1);
            assert_ne!(doc.sections[0].section_type, SectionType::Unknown,
                "Failed for type: {}", t);
            assert_eq!(doc.sections[0].title, "Test Title");
        }
    }

    #[test]
    fn test_parse_all_statuses() {
        let cases = [
            ("pending", SectionStatus::Pending),
            ("done", SectionStatus::Done),
            ("in-progress", SectionStatus::InProgress),
            ("blocked: need more info", SectionStatus::Blocked(Some("need more info".into()))),
            ("archived", SectionStatus::Archived),
            ("cancelled", SectionStatus::Cancelled),
        ];
        for (status_str, expected_status) in &cases {
            let source = format!("## [task|{}] Test", status_str);
            let doc = parse(&source);
            assert_eq!(doc.sections[0].status.as_ref(), Some(expected_status),
                "Failed for status: {}", status_str);
        }
    }

    #[test]
    fn test_parse_semantic_links() {
        let source = "## [task|pending] Build API\n\n\u{2192} depends: [[core.emd]]\n\u{2192} implements: REST endpoints\n";
        let doc = parse(source);
        assert_eq!(doc.sections.len(), 1);
        let links: Vec<_> = doc.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::Link(l) = e { Some(l) } else { None })
            .collect();
        assert_eq!(links.len(), 2, "Expected 2 links, got: {:?}", links);
        assert_eq!(links[0].relation, LinkRelation::Depends);
        assert_eq!(links[1].relation, LinkRelation::Implements);
    }

    #[test]
    fn test_parse_wiki_link() {
        let source = "## [summary] Overview\n\nSee [[other-file.emd#Section-Title]] for details";
        let doc = parse(source);
        let wl: Vec<_> = doc.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::WikiLink(l) = e { Some(l) } else { None })
            .collect();
        assert_eq!(wl.len(), 1);
        assert_eq!(wl[0].target, "other-file.emd");
        assert_eq!(wl[0].anchor.as_deref(), Some("Section-Title"));
    }

    #[test]
    fn test_parse_transclusion() {
        let source = "## [summary] Overview\n\n![[./docs/api.emd#Endpoints]]";
        let doc = parse(source);
        let tc: Vec<_> = doc.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::Transclusion(t) = e { Some(t) } else { None })
            .collect();
        assert_eq!(tc.len(), 1, "Expected 1 transclusion, got {:?}", doc.sections[0].content);
        assert_eq!(tc[0].target, "./docs/api.emd");
    }

    #[test]
    fn test_parse_code_block_with_tag() {
        let source = "## [verify] Tests\n\n```[verify]\nnpm test\n```\n";
        let doc = parse(source);
        let cb: Vec<_> = doc.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::CodeBlock(c) = e { Some(c) } else { None })
            .collect();
        assert_eq!(cb.len(), 1);
        assert_eq!(cb[0].tag, Some(CodeBlockTag::Verify));
        assert_eq!(cb[0].content.trim(), "npm test");
    }

    #[test]
    fn test_parse_metadata_comment() {
        let source = "## [task|done] Build\n\n<!-- STATUS: done -->";
        let doc = parse(source);
        let mc: Vec<_> = doc.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::MetadataComment(m) = e { Some(m) } else { None })
            .collect();
        assert_eq!(mc.len(), 1);
        assert_eq!(mc[0].key, "STATUS");
        assert_eq!(mc[0].value, "done");
    }

    #[test]
    fn test_error_recovery_unknown_type() {
        let source = "## [bogus] What\n\nContent";
        let doc = parse(source);
        assert_eq!(doc.sections.len(), 1);
        assert_eq!(doc.sections[0].section_type, SectionType::Unknown);
        assert!(!doc.diagnostics.is_empty());
    }

    #[test]
    fn test_never_null_ast_empty_input() {
        let doc = parse("");
        assert!(doc.sections.is_empty());
        assert!(doc.diagnostics.is_empty());
    }

    #[test]
    fn test_plain_markdown_still_parses() {
        let source = "# Hello\n\nThis is **bold** text.\n\n## Section\n\nMore text";
        let doc = parse(source);
        assert_eq!(doc.sections.len(), 2);
        assert_eq!(doc.sections[0].title, "Hello");
        assert_eq!(doc.sections[0].section_type, SectionType::Unknown);
    }

    #[test]
    fn test_multiple_sections() {
        let source = "## [summary] Overview\n\nText\n\n## [task|done] Task 1\n\nDone\n\n## [task|pending] Task 2\n\nTodo";
        let doc = parse(source);
        assert_eq!(doc.sections.len(), 3);
        assert_eq!(doc.sections[0].section_type, SectionType::Summary);
        assert_eq!(doc.sections[1].section_type, SectionType::Task);
        assert!(matches!(doc.sections[1].status, Some(SectionStatus::Done)));
        assert_eq!(doc.sections[2].section_type, SectionType::Task);
        assert!(matches!(doc.sections[2].status, Some(SectionStatus::Pending)));
    }

    #[test]
    fn test_code_block_with_language() {
        let source = "## [api] Methods\n\n```rust\nfn main() {}\n```\n";
        let doc = parse(source);
        let cb: Vec<_> = doc.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::CodeBlock(c) = e { Some(c) } else { None })
            .collect();
        assert_eq!(cb.len(), 1);
        assert_eq!(cb[0].language.as_deref(), Some("rust"));
    }

    #[test]
    fn test_all_code_block_tags() {
        let tags = [
            "verify", "prompt", "snippet", "html", "css", "mermaid",
            "katex", "diff", "todo", "vega", "3d", "gantt", "media",
            "schema", "draw",
        ];
        for tag in &tags {
            let source = format!("## [example] Test\n\n```[{}]\ncontent\n```\n", tag);
            let doc = parse(&source);
            let cb: Vec<_> = doc.sections[0].content.iter()
                .filter_map(|e| if let SectionElement::CodeBlock(c) = e { Some(c) } else { None })
                .collect();
            assert_eq!(cb.len(), 1, "Failed for tag: {}", tag);
            assert!(cb[0].tag.is_some(), "No tag found for: {}", tag);
        }
    }

    #[test]
    fn test_all_link_relations() {
        let relations = [
            "depends", "implements", "tested-by", "supersedes", "compatible-with",
            "alternative-to", "extends", "blocked-by",
            "param", "returns", "errors",
            "model", "tools", "memory", "context", "persona",
            "node", "edge", "entry", "max-iterations", "timeout",
            "store-in", "recall-from", "compress-after",
        ];
        for rel in &relations {
            let line = format!("\u{2192} {}: some-target", rel);
            let result = try_parse_semantic_link(&line, 1, &mut Vec::new());
            assert!(result.is_some(), "Failed for relation: {}", rel);
        }
    }

    #[test]
    fn test_custom_link_relation() {
        let line = "\u{2192} my-custom-rel: something";
        let result = try_parse_semantic_link(line, 1, &mut Vec::new());
        assert!(result.is_some());
        if let Some(link) = result {
            assert!(matches!(link.relation, LinkRelation::Custom(_)));
        }
    }

    #[test]
    fn test_blocked_with_reason() {
        let source = "## [task|blocked: waiting for API key] Setup";
        let doc = parse(source);
        let status = doc.sections[0].status.as_ref().unwrap();
        if let SectionStatus::Blocked(reason) = status {
            assert_eq!(reason.as_deref(), Some("waiting for API key"),
                "Expected reason 'waiting for API key', got: {:?}", reason);
        } else {
            panic!("Expected Blocked status, got: {:?}", status);
        }
    }

    #[test]
    fn test_semantic_link_with_condition() {
        let line = "\u{2192} edge: node1 -> node2 [condition: x > 5]";
        let result = try_parse_semantic_link(line, 1, &mut Vec::new());
        assert!(result.is_some());
        if let Some(link) = result {
            assert_eq!(link.relation, LinkRelation::Edge);
            assert_eq!(link.condition, Some("x > 5".to_string()));
        }
    }
}
