use crate::types::*;
use std::collections::HashMap;
use std::path::Path;
use std::time::SystemTime;

#[derive(Debug, Clone)]
pub struct SectionIndexEntry {
    pub file_path: String,
    pub section_type: SectionType,
    pub status: Option<SectionStatus>,
    pub title: String,
    pub summary: Option<String>,
    pub depends_on: Vec<String>,
    pub level: u8,
    pub source_line: usize,
}

#[derive(Debug, Clone, Default)]
pub struct EmdIndex {
    pub files: HashMap<String, Vec<SectionIndexEntry>>,
    pub file_contents: HashMap<String, String>,
    pub file_mtimes: HashMap<String, SystemTime>,
}

impl EmdIndex {
    pub fn new() -> Self {
        EmdIndex {
            files: HashMap::new(),
            file_contents: HashMap::new(),
            file_mtimes: HashMap::new(),
        }
    }

    pub fn add_document(&mut self, path: &str, doc: &EmdDocument) {
        let mut entries = Vec::new();
        collect_section_entries(&doc.sections, path, &mut entries);
        self.files.insert(path.to_string(), entries);
    }

    pub fn build_virtual(files: Vec<(String, String)>) -> Self {
        let mut index = EmdIndex::new();
        for (path, content) in files {
            let doc = crate::parser::parse(&content);
            index.file_contents.insert(path.clone(), content);
            index.add_document(&path, &doc);
        }
        index
    }

    pub fn build_from_dir(root: &Path) -> Result<Self, String> {
        let mut index = EmdIndex::new();
        for entry in walkdir::WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext != "emd" {
                continue;
            }
            let rel = path
                .strip_prefix(root)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            let content = std::fs::read_to_string(path).map_err(|e| format!("{}: {}", rel, e))?;
            let mtime = entry.metadata().ok().and_then(|m| m.modified().ok());
            if let Some(mt) = mtime {
                index.file_mtimes.insert(rel.clone(), mt);
            }
            let doc = crate::parser::parse(&content);
            index.file_contents.insert(rel.clone(), content);
            index.add_document(&rel, &doc);
        }
        Ok(index)
    }

    pub fn get_sections(&self, file: &str) -> Option<&Vec<SectionIndexEntry>> {
        self.files.get(file)
    }

    pub fn file_exists(&self, path: &str) -> bool {
        self.files.contains_key(path) || self.files.keys().any(|k| k.ends_with(path))
    }

    pub fn has_section(&self, file: &str, section: &str) -> bool {
        if let Some(sections) = self.files.get(file) {
            sections.iter().any(|s| s.title == section)
        } else {
            false
        }
    }

    pub fn find_section(&self, file: &str, section: &str) -> Option<&SectionIndexEntry> {
        if !file.is_empty() {
            if let Some(sections) = self.files.get(file) {
                if let Some(found) = sections.iter().find(|s| s.title == section) {
                    return Some(found);
                }
            }
        }

        if section.ends_with(".emd") || section.ends_with(".md") {
            if let Some(sections) = self.files.get(section) {
                return sections.first();
            }
            for (f, sections) in &self.files {
                if f.ends_with(section) {
                    return sections.first();
                }
            }
        }

        for (_, sections) in &self.files {
            for s in sections {
                if s.title == section {
                    return Some(s);
                }
            }
        }
        None
    }

    pub fn all_sections_by_type(&self, st: SectionType) -> Vec<&SectionIndexEntry> {
        let mut results = Vec::new();
        for (_, sections) in &self.files {
            for s in sections {
                if s.section_type == st {
                    results.push(s);
                }
            }
        }
        results
    }

    pub fn all_sections_by_status(&self, status: &SectionStatus) -> Vec<&SectionIndexEntry> {
        let mut results = Vec::new();
        for (_, sections) in &self.files {
            for s in sections {
                if s.status.as_ref() == Some(status) {
                    results.push(s);
                }
            }
        }
        results
    }

    pub fn sections_linking_to(&self, target_title: &str) -> Vec<&SectionIndexEntry> {
        let mut results = Vec::new();
        for (_, sections) in &self.files {
            for s in sections {
                if s.depends_on.iter().any(|d| d == target_title) {
                    results.push(s);
                }
            }
        }
        results
    }
}

fn collect_section_entries(sections: &[Section], file: &str, out: &mut Vec<SectionIndexEntry>) {
    for section in sections {
        let summary = if section.section_type == SectionType::Summary {
            section.content.iter().find_map(|e| {
                if let SectionElement::Text(t) = e {
                    if t.len() > 500 {
                        Some(t[..500].to_string())
                    } else {
                        Some(t.clone())
                    }
                } else {
                    None
                }
            })
        } else {
            None
        };

        let depends_on: Vec<String> = section
            .content
            .iter()
            .filter_map(|e| {
                if let SectionElement::Link(link) = e {
                    if matches!(link.relation, LinkRelation::Depends) {
                        Some(link.target.clone())
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        out.push(SectionIndexEntry {
            file_path: file.to_string(),
            section_type: section.section_type,
            status: section.status.clone(),
            title: section.title.clone(),
            summary,
            depends_on,
            level: section.level,
            source_line: section.source_span.start_line,
        });

        collect_section_entries(&section.subsections, file, out);
    }
}

pub struct ContextLoader {
    index: EmdIndex,
    budget: usize,
    cache: HashMap<String, CachedSlice>,
    priority_scheme: LoadingPriority,
}

#[derive(Debug, Clone)]
pub struct CachedSlice {
    pub tokens: String,
    pub token_count: usize,
    pub cached_at: SystemTime,
}

#[derive(Debug, Clone)]
pub struct LoadingPriority {
    direct_loads_first: bool,
    status_only_before_body: bool,
    skip_visual_sections: bool,
}

impl Default for LoadingPriority {
    fn default() -> Self {
        LoadingPriority {
            direct_loads_first: true,
            status_only_before_body: true,
            skip_visual_sections: true,
        }
    }
}

impl ContextLoader {
    pub fn new(index: EmdIndex) -> Self {
        ContextLoader {
            index,
            budget: 8000,
            cache: HashMap::new(),
            priority_scheme: LoadingPriority::default(),
        }
    }

    pub fn with_budget(mut self, budget: usize) -> Self {
        self.budget = budget;
        self
    }

    pub fn set_budget(&mut self, budget: usize) {
        self.budget = budget;
        self.invalidate_cache();
    }

    pub fn load_summaries(&self) -> Vec<&SectionIndexEntry> {
        self.index.all_sections_by_type(SectionType::Summary)
    }

    pub fn load_by_type(&self, kind: SectionType) -> Vec<&SectionIndexEntry> {
        self.index.all_sections_by_type(kind)
    }

    pub fn load_by_status(&self, status: &SectionStatus) -> Vec<&SectionIndexEntry> {
        self.index.all_sections_by_status(status)
    }

    pub fn load_for_task(&self, task_name: &str) -> ContextResult {
        let mut result = ContextResult::default();

        if let Some(task_section) = self.index.find_section("", task_name).cloned() {
            result.task = Some(ContextSlice {
                title: task_section.title.clone(),
                section_type: format!("{:?}", task_section.section_type),
                status: task_section.status.as_ref().map(|s| s.as_str()),
                file: task_section.file_path.clone(),
                summary: task_section.summary.clone(),
                dep_statuses: Vec::new(),
                token_estimate: 0,
            });

            for dep_name in &task_section.depends_on {
                if let Some(dep_section) = self.index.find_section("", dep_name) {
                    result.dep_statuses.push(ContextSlice {
                        title: dep_section.title.clone(),
                        section_type: format!("{:?}", dep_section.section_type),
                        status: dep_section.status.as_ref().map(|s| s.as_str()),
                        file: dep_section.file_path.clone(),
                        summary: dep_section.summary.clone(),
                        dep_statuses: Vec::new(),
                        token_estimate: 0,
                    });
                }
            }
        }

        result
    }

    pub fn resolve_context(&self, entry_title: &str) -> ContextResult {
        let mut result = self.load_for_task(entry_title);
        let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();

        if let Some(ref task) = result.task {
            visited.insert(task.title.clone());
        }

        let mut to_resolve: Vec<ContextSlice> = result.dep_statuses.clone();
        let mut depth = 0;
        const MAX_DEPTH: usize = 5;

        while !to_resolve.is_empty() && depth < MAX_DEPTH {
            let current = std::mem::take(&mut to_resolve);
            for dep in &current {
                if visited.contains(&dep.title) {
                    continue;
                }
                visited.insert(dep.title.clone());
                result.resolved_deps.push(dep.clone());
                if let Some(deeper) = self.index.find_section("", &dep.title) {
                    for sub_dep in &deeper.depends_on {
                        if !visited.contains(sub_dep) {
                            if let Some(sub_section) = self.index.find_section("", sub_dep) {
                                to_resolve.push(ContextSlice {
                                    title: sub_section.title.clone(),
                                    section_type: format!("{:?}", sub_section.section_type),
                                    status: sub_section.status.as_ref().map(|s| s.as_str()),
                                    file: sub_section.file_path.clone(),
                                    summary: sub_section.summary.clone(),
                                    dep_statuses: Vec::new(),
                                    token_estimate: 0,
                                });
                            }
                        }
                    }
                }
            }
            depth += 1;
        }

        result
    }

    pub fn load_within_budget(&self, priority_entries: &[&str]) -> BudgetResult {
        let mut result = BudgetResult::default();
        let mut tokens_used = 0;

        let mut all_entries: Vec<&SectionIndexEntry> = Vec::new();

        for title in priority_entries {
            if let Some(entry) = self.index.find_section("", title) {
                all_entries.push(entry);
            }
        }

        for entry in &all_entries {
            if entry.section_type == SectionType::Human {
                let text = self.get_section_text(entry);
                let count = count_tokens_estimate(&text);
                tokens_used += count;
                result.loaded.push(entry.title.clone());
                continue;
            }
        }

        for entry in &all_entries {
            if entry.section_type == SectionType::Human {
                continue;
            }
            if self.priority_scheme.skip_visual_sections
                && matches!(
                    entry.section_type,
                    SectionType::Draw | SectionType::Flow | SectionType::Kanban
                )
            {
                continue;
            }
            let text = self.get_section_text(entry);
            let count = count_tokens_estimate(&text);
            if tokens_used + count <= self.budget {
                tokens_used += count;
                result.loaded.push(entry.title.clone());
            } else {
                break;
            }
        }

        result.tokens_used = tokens_used;
        result.budget = self.budget;
        result.truncated = tokens_used >= self.budget;

        result
    }

    fn get_section_text(&self, entry: &SectionIndexEntry) -> String {
        self.index
            .file_contents
            .get(&entry.file_path)
            .cloned()
            .unwrap_or_default()
    }

    pub fn load_with_cache(&mut self, query: &str) -> Option<CachedSlice> {
        let now = SystemTime::now();

        let is_stale = self
            .index
            .file_mtimes
            .iter()
            .any(|(_, mtime)| {
                if let Ok(d) = now.duration_since(*mtime) {
                    d.as_secs() > 60
                } else {
                    true
                }
            });

        if is_stale {
            self.invalidate_cache();
        }

        if let Some(cached) = self.cache.get(query) {
            return Some(cached.clone());
        }

        let result = match query {
            "summaries" => {
                let entries = self.load_summaries();
                let text: String = entries
                    .iter()
                    .map(|e| format!("{}: {}", e.title, e.summary.as_deref().unwrap_or("")))
                    .collect::<Vec<_>>()
                    .join("\n");
                let count = count_tokens_estimate(&text);
                (text, count)
            }
            "tasks|pending" => {
                let entries = self.load_by_status(&SectionStatus::Pending);
                let text: String = entries
                    .iter()
                    .map(|e| {
                        let status_str = e
                            .status
                            .as_ref()
                            .map(|s| s.as_str())
                            .unwrap_or_else(|| "?".to_string());
                        format!(
                            "[{}] {} ({})",
                            status_str,
                            e.title,
                            e.file_path
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                let count = count_tokens_estimate(&text);
                (text, count)
            }
            _ => {
                let result = self.load_within_budget(&[query]);
                let text = result.loaded.join("\n");
                (text.clone(), count_tokens_estimate(&text))
            }
        };

        let slice = CachedSlice {
            tokens: result.0,
            token_count: result.1,
            cached_at: now,
        };
        self.cache.insert(query.to_string(), slice);
        self.cache.get(query).cloned()
    }

    pub fn invalidate_cache(&mut self) {
        self.cache.clear();
    }

    pub fn index(&self) -> &EmdIndex {
        &self.index
    }
}

#[derive(Debug, Clone, Default)]
pub struct ContextResult {
    pub task: Option<ContextSlice>,
    pub dep_statuses: Vec<ContextSlice>,
    pub resolved_deps: Vec<ContextSlice>,
    pub token_estimate: usize,
}

#[derive(Debug, Clone)]
pub struct ContextSlice {
    pub title: String,
    pub section_type: String,
    pub status: Option<String>,
    pub file: String,
    pub summary: Option<String>,
    pub dep_statuses: Vec<ContextSlice>,
    pub token_estimate: usize,
}

#[derive(Debug, Clone, Default)]
pub struct BudgetResult {
    pub loaded: Vec<String>,
    pub tokens_used: usize,
    pub budget: usize,
    pub truncated: bool,
}

pub fn count_tokens_estimate(text: &str) -> usize {
    let byte_count = text.len();
    let char_count = text.chars().count();
    let word_count = text.split_whitespace().count();
    (byte_count / 4).max(char_count / 3).max(word_count).max(1)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn count_tokens_tiktoken(text: &str) -> Result<usize, String> {
    let bpe = tiktoken_rs::cl100k_base().map_err(|e| format!("tiktoken init: {}", e))?;
    Ok(bpe.encode_ordinary(text).len())
}

#[cfg(target_arch = "wasm32")]
pub fn count_tokens_tiktoken(text: &str) -> Result<usize, String> {
    Ok(count_tokens_estimate(text))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    fn build_test_index() -> EmdIndex {
        let mut index = EmdIndex::new();

        let content1 = r#"## [summary] Project Overview
This is a test project for EMD.

## [task|pending] Build API
→ depends: core.emd
Implement REST endpoints.

## [task|done] Setup
Project initialized.

## [human] Notes
Important design decisions here.
"#;

        let content2 = r#"## [task|pending] core
Core library implementation.

## [task|done] tests
All tests pass.

## [summary] Core Module
Handles core logic.
"#;

        let doc1 = parse(content1);
        let doc2 = parse(content2);

        index.file_contents.insert("project.emd".to_string(), content1.to_string());
        index.file_contents.insert("core.emd".to_string(), content2.to_string());
        index.add_document("project.emd", &doc1);
        index.add_document("core.emd", &doc2);

        index
    }

    #[test]
    fn test_load_summaries() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let summaries = loader.load_summaries();
        assert!(!summaries.is_empty());
        assert!(summaries.iter().all(|s| s.section_type == SectionType::Summary));
    }

    #[test]
    fn test_load_by_type() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let tasks = loader.load_by_type(SectionType::Task);
        assert!(!tasks.is_empty());
        assert!(tasks.iter().all(|t| t.section_type == SectionType::Task));
    }

    #[test]
    fn test_load_by_status() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let pending = loader.load_by_status(&SectionStatus::Pending);
        assert!(pending.iter().all(|t| matches!(t.status, Some(SectionStatus::Pending))));
    }

    #[test]
    fn test_load_for_task() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let ctx = loader.load_for_task("Build API");
        assert!(ctx.task.is_some());
        assert!(!ctx.dep_statuses.is_empty());
    }

    #[test]
    fn test_resolve_context() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let ctx = loader.resolve_context("Build API");
        assert!(ctx.task.is_some());
        assert!(!ctx.resolved_deps.is_empty());
    }

    #[test]
    fn test_load_within_budget() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let result = loader.load_within_budget(&["Build API", "Setup", "core"]);
        assert!(!result.loaded.is_empty());
        assert!(result.tokens_used > 0);
    }

    #[test]
    fn test_human_sections_always_included() {
        let index = build_test_index();
        let loader = ContextLoader::new(index);
        let result = loader.load_within_budget(&["Notes"]);
        assert!(result.loaded.contains(&"Notes".to_string()));
    }

    #[test]
    fn test_cache_returns_on_second_query() {
        let index = build_test_index();
        let mut loader = ContextLoader::new(index);
        let first = loader.load_with_cache("summaries").unwrap().tokens.clone();
        let second = loader.load_with_cache("summaries").unwrap().tokens.clone();
        assert_eq!(first, second);
    }

    #[test]
    fn test_invalidate_cache() {
        let index = build_test_index();
        let mut loader = ContextLoader::new(index);
        let first = loader.load_with_cache("tasks|pending").unwrap().tokens.clone();
        loader.invalidate_cache();
        let second = loader.load_with_cache("tasks|pending").unwrap().tokens.clone();
        assert_eq!(first, second);
    }

    #[test]
    fn test_count_tokens_estimate() {
        let text = "Hello world";
        let count = count_tokens_estimate(text);
        assert!(count > 0);
        assert!(count <= text.len());
    }
}
