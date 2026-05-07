use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmdDocument {
    pub sections: Vec<Section>,
    pub diagnostics: Vec<Diagnostic>,
    pub metadata: DocumentMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub version: Option<String>,
    pub owner: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Section {
    pub level: u8,
    pub section_type: SectionType,
    pub status: Option<SectionStatus>,
    pub title: String,
    pub content: Vec<SectionElement>,
    pub subsections: Vec<Section>,
    pub source_span: SourceSpan,
    pub diagnostics: Vec<Diagnostic>,
    pub metadata: SectionMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct SectionMetadata {
    pub status_override: Option<String>,
    pub depends_on: Vec<String>,
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectionElement {
    Paragraph(String),
    CodeBlock(CodeBlock),
    Link(SemanticLink),
    WikiLink(WikiLink),
    Transclusion(Transclusion),
    MetadataComment(MetadataComment),
    Text(String),
    List(Vec<SectionElement>),
    BlockQuote(String),
    Heading { level: u8, text: String },
    HorizontalRule,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CodeBlock {
    pub tag: Option<CodeBlockTag>,
    pub language: Option<String>,
    pub content: String,
    pub source_span: SourceSpan,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SemanticLink {
    pub relation: LinkRelation,
    pub target: String,
    pub condition: Option<String>,
    pub source_span: SourceSpan,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WikiLink {
    pub target: String,
    pub anchor: Option<String>,
    pub source_span: SourceSpan,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transclusion {
    pub target: String,
    pub anchor: Option<String>,
    pub source_span: SourceSpan,
    pub resolved_content: Option<Vec<SectionElement>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MetadataComment {
    pub key: String,
    pub value: String,
    pub source_span: SourceSpan,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SectionType {
    Summary,
    Detail,
    Task,
    Decision,
    Api,
    Spec,
    Agent,
    Human,
    Verify,
    Config,
    Graph,
    Draw,
    Flow,
    Kanban,
    Template,
    Example,
    Unknown,
}

impl SectionType {
    pub fn from_str(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "summary" => SectionType::Summary,
            "detail" => SectionType::Detail,
            "task" => SectionType::Task,
            "decision" => SectionType::Decision,
            "api" => SectionType::Api,
            "spec" => SectionType::Spec,
            "agent" => SectionType::Agent,
            "human" => SectionType::Human,
            "verify" => SectionType::Verify,
            "config" => SectionType::Config,
            "graph" => SectionType::Graph,
            "draw" => SectionType::Draw,
            "flow" => SectionType::Flow,
            "kanban" => SectionType::Kanban,
            "template" => SectionType::Template,
            "example" => SectionType::Example,
            _ => SectionType::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SectionType::Summary => "summary",
            SectionType::Detail => "detail",
            SectionType::Task => "task",
            SectionType::Decision => "decision",
            SectionType::Api => "api",
            SectionType::Spec => "spec",
            SectionType::Agent => "agent",
            SectionType::Human => "human",
            SectionType::Verify => "verify",
            SectionType::Config => "config",
            SectionType::Graph => "graph",
            SectionType::Draw => "draw",
            SectionType::Flow => "flow",
            SectionType::Kanban => "kanban",
            SectionType::Template => "template",
            SectionType::Example => "example",
            SectionType::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectionStatus {
    Done,
    Pending,
    InProgress,
    Blocked(Option<String>),
    Archived,
    Cancelled,
}

impl SectionStatus {
    pub fn from_str(s: &str) -> Self {
        let s_trimmed = s.trim();
        let s_lower = s_trimmed.to_lowercase();
        if s_lower.starts_with("blocked") {
            let reason = s_trimmed
                .strip_prefix("blocked")
                .or_else(|| s_trimmed.strip_prefix("Blocked"))
                .or_else(|| s_trimmed.strip_prefix("BLOCKED"))
                .and_then(|r| r.strip_prefix(':').or(Some(r)))
                .map(|r| r.trim().to_string())
                .filter(|r| !r.is_empty());
            return SectionStatus::Blocked(reason);
        }
        match s_lower.as_str() {
            "done" => SectionStatus::Done,
            "pending" => SectionStatus::Pending,
            "in-progress" | "in_progress" | "inprogress" => SectionStatus::InProgress,
            "archived" => SectionStatus::Archived,
            "cancelled" | "canceled" => SectionStatus::Cancelled,
            _ => SectionStatus::Pending,
        }
    }

    pub fn as_str(&self) -> String {
        match self {
            SectionStatus::Done => "done".to_string(),
            SectionStatus::Pending => "pending".to_string(),
            SectionStatus::InProgress => "in-progress".to_string(),
            SectionStatus::Blocked(reason) => {
                if let Some(ref r) = reason {
                    format!("blocked: {}", r)
                } else {
                    "blocked".to_string()
                }
            }
            SectionStatus::Archived => "archived".to_string(),
            SectionStatus::Cancelled => "cancelled".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LinkRelation {
    Depends,
    Implements,
    TestedBy,
    Supersedes,
    CompatibleWith,
    AlternativeTo,
    Extends,
    BlockedBy,
    Param,
    Returns,
    Errors,
    Model,
    Tools,
    Memory,
    Context,
    Persona,
    Node,
    Edge,
    Entry,
    MaxIterations,
    Timeout,
    StoreIn,
    RecallFrom,
    CompressAfter,
    Custom(String),
}

impl LinkRelation {
    pub fn from_str(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "depends" | "depends-on" | "depends_on" => LinkRelation::Depends,
            "implements" => LinkRelation::Implements,
            "tested-by" | "tested_by" => LinkRelation::TestedBy,
            "supersedes" => LinkRelation::Supersedes,
            "compatible-with" | "compatible_with" => LinkRelation::CompatibleWith,
            "alternative-to" | "alternative_to" => LinkRelation::AlternativeTo,
            "extends" => LinkRelation::Extends,
            "blocked-by" | "blocked_by" => LinkRelation::BlockedBy,
            "param" | "parameter" => LinkRelation::Param,
            "returns" | "return" => LinkRelation::Returns,
            "errors" | "error" => LinkRelation::Errors,
            "model" => LinkRelation::Model,
            "tools" => LinkRelation::Tools,
            "memory" => LinkRelation::Memory,
            "context" => LinkRelation::Context,
            "persona" => LinkRelation::Persona,
            "node" => LinkRelation::Node,
            "edge" => LinkRelation::Edge,
            "entry" => LinkRelation::Entry,
            "max-iterations" | "max_iterations" => LinkRelation::MaxIterations,
            "timeout" => LinkRelation::Timeout,
            "store-in" | "store_in" => LinkRelation::StoreIn,
            "recall-from" | "recall_from" => LinkRelation::RecallFrom,
            "compress-after" | "compress_after" => LinkRelation::CompressAfter,
            other => LinkRelation::Custom(other.to_string()),
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            LinkRelation::Depends => "depends",
            LinkRelation::Implements => "implements",
            LinkRelation::TestedBy => "tested-by",
            LinkRelation::Supersedes => "supersedes",
            LinkRelation::CompatibleWith => "compatible-with",
            LinkRelation::AlternativeTo => "alternative-to",
            LinkRelation::Extends => "extends",
            LinkRelation::BlockedBy => "blocked-by",
            LinkRelation::Param => "param",
            LinkRelation::Returns => "returns",
            LinkRelation::Errors => "errors",
            LinkRelation::Model => "model",
            LinkRelation::Tools => "tools",
            LinkRelation::Memory => "memory",
            LinkRelation::Context => "context",
            LinkRelation::Persona => "persona",
            LinkRelation::Node => "node",
            LinkRelation::Edge => "edge",
            LinkRelation::Entry => "entry",
            LinkRelation::MaxIterations => "max-iterations",
            LinkRelation::Timeout => "timeout",
            LinkRelation::StoreIn => "store-in",
            LinkRelation::RecallFrom => "recall-from",
            LinkRelation::CompressAfter => "compress-after",
            LinkRelation::Custom(_) => "custom",
        }
    }

    pub fn is_valid_in(&self, section_type: &SectionType) -> bool {
        match self {
            LinkRelation::Param | LinkRelation::Returns | LinkRelation::Errors => {
                matches!(section_type, SectionType::Api)
            }
            LinkRelation::Model | LinkRelation::Tools | LinkRelation::Memory
            | LinkRelation::Context | LinkRelation::Persona => {
                matches!(section_type, SectionType::Agent)
            }
            LinkRelation::Node | LinkRelation::Edge | LinkRelation::Entry
            | LinkRelation::MaxIterations | LinkRelation::Timeout => {
                matches!(section_type, SectionType::Graph)
            }
            LinkRelation::StoreIn | LinkRelation::RecallFrom | LinkRelation::CompressAfter => {
                matches!(section_type, SectionType::Agent | SectionType::Config)
            }
            _ => true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeBlockTag {
    Verify,
    Prompt,
    Snippet,
    Html,
    Css,
    Mermaid,
    Katex,
    Diff,
    Todo,
    Vega,
    ThreeD,
    Gantt,
    Media,
    Schema,
    Draw,
}

impl CodeBlockTag {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.trim().to_lowercase().as_str() {
            "verify" => Some(CodeBlockTag::Verify),
            "prompt" => Some(CodeBlockTag::Prompt),
            "snippet" => Some(CodeBlockTag::Snippet),
            "html" => Some(CodeBlockTag::Html),
            "css" => Some(CodeBlockTag::Css),
            "mermaid" => Some(CodeBlockTag::Mermaid),
            "katex" => Some(CodeBlockTag::Katex),
            "diff" => Some(CodeBlockTag::Diff),
            "todo" => Some(CodeBlockTag::Todo),
            "vega" => Some(CodeBlockTag::Vega),
            "3d" | "three-d" | "three_d" => Some(CodeBlockTag::ThreeD),
            "gantt" => Some(CodeBlockTag::Gantt),
            "media" => Some(CodeBlockTag::Media),
            "schema" => Some(CodeBlockTag::Schema),
            "draw" => Some(CodeBlockTag::Draw),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            CodeBlockTag::Verify => "verify",
            CodeBlockTag::Prompt => "prompt",
            CodeBlockTag::Snippet => "snippet",
            CodeBlockTag::Html => "html",
            CodeBlockTag::Css => "css",
            CodeBlockTag::Mermaid => "mermaid",
            CodeBlockTag::Katex => "katex",
            CodeBlockTag::Diff => "diff",
            CodeBlockTag::Todo => "todo",
            CodeBlockTag::Vega => "vega",
            CodeBlockTag::ThreeD => "3d",
            CodeBlockTag::Gantt => "gantt",
            CodeBlockTag::Media => "media",
            CodeBlockTag::Schema => "schema",
            CodeBlockTag::Draw => "draw",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceSpan {
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub end_col: usize,
}

impl SourceSpan {
    pub fn new(start_line: usize, start_col: usize, end_line: usize, end_col: usize) -> Self {
        SourceSpan {
            start_line,
            start_col,
            end_line,
            end_col,
        }
    }

    pub fn empty() -> Self {
        SourceSpan {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub source_span: Option<SourceSpan>,
    pub code: Option<String>,
}

impl Diagnostic {
    pub fn error(message: impl Into<String>) -> Self {
        Diagnostic {
            severity: DiagnosticSeverity::Error,
            message: message.into(),
            source_span: None,
            code: None,
        }
    }

    pub fn warning(message: impl Into<String>) -> Self {
        Diagnostic {
            severity: DiagnosticSeverity::Warning,
            message: message.into(),
            source_span: None,
            code: None,
        }
    }

    pub fn info(message: impl Into<String>) -> Self {
        Diagnostic {
            severity: DiagnosticSeverity::Info,
            message: message.into(),
            source_span: None,
            code: None,
        }
    }

    pub fn hint(message: impl Into<String>) -> Self {
        Diagnostic {
            severity: DiagnosticSeverity::Hint,
            message: message.into(),
            source_span: None,
            code: None,
        }
    }

    pub fn with_span(mut self, span: SourceSpan) -> Self {
        self.source_span = Some(span);
        self
    }

    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = Some(code.into());
        self
    }
}

impl fmt::Display for DiagnosticSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DiagnosticSeverity::Error => write!(f, "error"),
            DiagnosticSeverity::Warning => write!(f, "warning"),
            DiagnosticSeverity::Info => write!(f, "info"),
            DiagnosticSeverity::Hint => write!(f, "hint"),
        }
    }
}

pub const ALL_SECTION_TYPES: &[SectionType] = &[
    SectionType::Summary,
    SectionType::Detail,
    SectionType::Task,
    SectionType::Decision,
    SectionType::Api,
    SectionType::Spec,
    SectionType::Agent,
    SectionType::Human,
    SectionType::Verify,
    SectionType::Config,
    SectionType::Graph,
    SectionType::Draw,
    SectionType::Flow,
    SectionType::Kanban,
    SectionType::Template,
    SectionType::Example,
];

pub const ALL_CODE_BLOCK_TAGS: &[CodeBlockTag] = &[
    CodeBlockTag::Verify,
    CodeBlockTag::Prompt,
    CodeBlockTag::Snippet,
    CodeBlockTag::Html,
    CodeBlockTag::Css,
    CodeBlockTag::Mermaid,
    CodeBlockTag::Katex,
    CodeBlockTag::Diff,
    CodeBlockTag::Todo,
    CodeBlockTag::Vega,
    CodeBlockTag::ThreeD,
    CodeBlockTag::Gantt,
    CodeBlockTag::Media,
    CodeBlockTag::Schema,
    CodeBlockTag::Draw,
];

pub const ALL_LINK_RELATIONS: &[LinkRelation] = &[
    LinkRelation::Depends,
    LinkRelation::Implements,
    LinkRelation::TestedBy,
    LinkRelation::Supersedes,
    LinkRelation::CompatibleWith,
    LinkRelation::AlternativeTo,
    LinkRelation::Extends,
    LinkRelation::BlockedBy,
    LinkRelation::Param,
    LinkRelation::Returns,
    LinkRelation::Errors,
    LinkRelation::Model,
    LinkRelation::Tools,
    LinkRelation::Memory,
    LinkRelation::Context,
    LinkRelation::Persona,
    LinkRelation::Node,
    LinkRelation::Edge,
    LinkRelation::Entry,
    LinkRelation::MaxIterations,
    LinkRelation::Timeout,
    LinkRelation::StoreIn,
    LinkRelation::RecallFrom,
    LinkRelation::CompressAfter,
];
