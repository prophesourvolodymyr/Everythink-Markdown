use crate::types::*;
use crate::context_loader::EmdIndex;
use std::collections::{HashMap, HashSet};

pub fn validate(doc: &EmdDocument, index: &EmdIndex, strict: bool) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    diagnostics.extend(doc.diagnostics.clone());
    validate_sections(&doc.sections, index, strict, &mut diagnostics);
    diagnostics
}

fn validate_sections(
    sections: &[Section],
    index: &EmdIndex,
    strict: bool,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let mut task_statuses: HashMap<&str, &SectionStatus> = HashMap::new();
    let mut pending_deps: HashSet<&str> = HashSet::new();

    for section in sections {
        validate_section_context(section, strict, diagnostics);
        validate_wiki_links(section, index, diagnostics);
        validate_code_blocks(section, diagnostics);

        if section.section_type == SectionType::Task {
            if let Some(ref status) = section.status {
                task_statuses.insert(&section.title, status);
                if matches!(status, SectionStatus::Pending | SectionStatus::InProgress) {
                    pending_deps.insert(&section.title);
                }
            }
        }

        if !section.subsections.is_empty() {
            validate_sections(&section.subsections, index, strict, diagnostics);
        }
    }

    validate_status_consistency(sections, &task_statuses, &pending_deps, diagnostics);
    validate_circular_dependencies(sections, diagnostics);
}

fn validate_section_context(
    section: &Section,
    _strict: bool,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for element in &section.content {
        if let SectionElement::Link(link) = element {
            if !link.relation.is_valid_in(&section.section_type) {
                if !matches!(link.relation, LinkRelation::Custom(_)) {
                    diagnostics.push(
                        Diagnostic::warning(format!(
                            "Link relation '{}' is not valid in [{}] section context",
                            link.relation.as_str(),
                            section.section_type.as_str()
                        ))
                        .with_code("EMD100"),
                    );
                }
            }
        }
    }
}

fn validate_wiki_links(
    section: &Section,
    index: &EmdIndex,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for element in &section.content {
        match element {
            SectionElement::WikiLink(wl) => {
                if wl.target.ends_with(".emd") || wl.target.ends_with(".md") {
                    if !index.file_exists(&wl.target) {
                        diagnostics.push(
                            Diagnostic::warning(format!(
                                "Unresolved wiki-link target: '{}'",
                                wl.target
                            ))
                            .with_code("EMD101"),
                        );
                    }
                }
            }
            SectionElement::Transclusion(tc) => {
                if !index.file_exists(&tc.target) {
                    diagnostics.push(
                        Diagnostic::warning(format!(
                            "Unresolved transclusion target: '{}'",
                            tc.target
                        ))
                        .with_code("EMD102"),
                    );
                }
            }
            _ => {}
        }
    }
}

fn validate_code_blocks(section: &Section, diagnostics: &mut Vec<Diagnostic>) {
    for element in &section.content {
        if let SectionElement::CodeBlock(cb) = element {
            if let Some(ref tag) = cb.tag {
                let content = cb.content.trim().to_lowercase();
                match tag {
                    CodeBlockTag::Mermaid => {
                        let has_diagram = content.contains("graph")
                            || content.contains("flowchart")
                            || content.contains("sequence")
                            || content.contains("class")
                            || content.contains("state");
                        if !has_diagram && !content.is_empty() {
                            diagnostics.push(
                                Diagnostic::hint(format!(
                                    "[mermaid] code block may not contain valid diagram syntax"
                                ))
                                .with_code("EMD200"),
                            );
                        }
                    }
                    CodeBlockTag::Katex => {
                        let has_math = content.contains('$')
                            || content.contains('\\')
                            || content.contains('{');
                        if !has_math && !content.is_empty() {
                            diagnostics.push(
                                Diagnostic::hint(format!(
                                    "[katex] code block may not contain valid math syntax"
                                ))
                                .with_code("EMD201"),
                            );
                        }
                    }
                    CodeBlockTag::Html => {
                        let has_html = content.contains('<')
                            && (content.contains('>') || content.contains("html")
                                || content.contains("div")
                                || content.contains("body"));
                        if !has_html && !content.is_empty() {
                            diagnostics.push(
                                Diagnostic::hint(format!(
                                    "[html] code block may not contain valid HTML"
                                ))
                                .with_code("EMD202"),
                            );
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

fn validate_status_consistency(
    sections: &[Section],
    task_statuses: &HashMap<&str, &SectionStatus>,
    pending_deps: &HashSet<&str>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for section in sections {
        if let Some(ref status) = section.status {
            match status {
                SectionStatus::Done => {
                    for element in &section.content {
                        if let SectionElement::Link(link) = element {
                            if matches!(link.relation, LinkRelation::Depends) {
                                let dep_name = &link.target;
                                if pending_deps.contains(dep_name.as_str()) {
                                    diagnostics.push(
                                        Diagnostic::warning(format!(
                                            "Section '{}' is marked done but depends on pending '{}'",
                                            section.title, dep_name
                                        ))
                                        .with_code("EMD300"),
                                    );
                                }
                            }
                        }
                    }
                }
                SectionStatus::Blocked(ref reason) => {
                    for element in &section.content {
                        if let SectionElement::Link(link) = element {
                            if matches!(link.relation, LinkRelation::BlockedBy | LinkRelation::Depends) {
                                if let Some(blocker_status) = task_statuses.get(link.target.as_str()) {
                                    if matches!(blocker_status, SectionStatus::Done | SectionStatus::Archived) {
                                        diagnostics.push(
                                            Diagnostic::warning(format!(
                                                "Section '{}' is blocked{} but blocker '{}' is {}",
                                                section.title,
                                                reason.as_ref().map(|r| format!(" ({})", r)).unwrap_or_default(),
                                                link.target,
                                                blocker_status.as_str()
                                            ))
                                            .with_code("EMD301"),
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }
}

fn validate_circular_dependencies(sections: &[Section], diagnostics: &mut Vec<Diagnostic>) {
    #[derive(Clone)]
    struct DepEdge {
        from: String,
        to: String,
    }

    let mut edges: Vec<DepEdge> = Vec::new();

    fn collect_edges(sections: &[Section], edges: &mut Vec<DepEdge>) {
        for section in sections {
            for element in &section.content {
                if let SectionElement::Link(link) = element {
                    if matches!(link.relation, LinkRelation::Depends) {
                        edges.push(DepEdge {
                            from: section.title.clone(),
                            to: link.target.clone(),
                        });
                    }
                }
            }
            collect_edges(&section.subsections, edges);
        }
    }

    collect_edges(sections, &mut edges);

    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();
    for edge in &edges {
        adj.entry(&edge.from).or_default().push(&edge.to);
    }

    fn dfs(
        node: &str,
        adj: &HashMap<&str, Vec<&str>>,
        visited: &mut HashSet<String>,
        rec_stack: &mut HashSet<String>,
        depth: usize,
        max_depth: usize,
    ) -> Option<Vec<String>> {
        if depth > max_depth {
            return None;
        }
        if rec_stack.contains(node) {
            return Some(vec![node.to_string()]);
        }
        if visited.contains(node) {
            return None;
        }
        visited.insert(node.to_string());
        rec_stack.insert(node.to_string());

        if let Some(neighbors) = adj.get(node) {
            for &neighbor in neighbors {
                if let Some(mut cycle) = dfs(neighbor, adj, visited, rec_stack, depth + 1, max_depth) {
                    if cycle.len() < 10 {
                        cycle.insert(0, node.to_string());
                    }
                    return Some(cycle);
                }
            }
        }

        rec_stack.remove(node);
        None
    }

    let mut visited_global: HashSet<String> = HashSet::new();
    for edge in &edges {
        if !visited_global.contains(&edge.from) {
            let mut rec_stack = HashSet::new();
            if let Some(cycle) = dfs(&edge.from, &adj, &mut visited_global, &mut rec_stack, 0, 50) {
                diagnostics.push(
                    Diagnostic::error(format!(
                        "Circular dependency detected: {}",
                        cycle.join(" -> ")
                    ))
                    .with_code("EMD400"),
                );
                break;
            }
        }
    }
}

pub fn validate_graph(section: &Section, diagnostics: &mut Vec<Diagnostic>) {
    let mut nodes: HashSet<String> = HashSet::new();
    let mut edges: Vec<(String, String)> = Vec::new();
    let mut entry_node: Option<String> = None;
    let mut max_iterations: Option<u64> = None;
    let mut timeout_ms: Option<u64> = None;

    for element in &section.content {
        if let SectionElement::Link(link) = element {
            match link.relation {
                LinkRelation::Node => {
                    nodes.insert(link.target.clone());
                }
                LinkRelation::Edge => {
                    if let Some((from, to)) = link.target.split_once("->") {
                        edges.push((from.trim().to_string(), to.trim().to_string()));
                    } else {
                        diagnostics.push(
                            Diagnostic::error(format!(
                                "Invalid edge format: '{}'. Expected 'node -> node'",
                                link.target
                            ))
                            .with_code("EMD500"),
                        );
                    }
                }
                LinkRelation::Entry => {
                    entry_node = Some(link.target.clone());
                }
                LinkRelation::MaxIterations => {
                    max_iterations = link.target.trim().parse().ok();
                }
                LinkRelation::Timeout => {
                    timeout_ms = link.target.trim().parse().ok();
                }
                _ => {}
            }
        }
    }

    for (from, to) in &edges {
        if !nodes.contains(from) {
            diagnostics.push(
                Diagnostic::error(format!(
                    "Edge references non-existent source node: '{}'",
                    from
                ))
                .with_code("EMD501"),
            );
        }
        if !nodes.contains(to) {
            diagnostics.push(
                Diagnostic::error(format!(
                    "Edge references non-existent target node: '{}'",
                    to
                ))
                .with_code("EMD502"),
            );
        }
    }

    if let Some(ref entry) = entry_node {
        if !nodes.contains(entry) {
            diagnostics.push(
                Diagnostic::error(format!(
                    "Entry node '{}' does not exist in graph nodes",
                    entry
                ))
                .with_code("EMD503"),
            );
        }
    }

    if let Some(iters) = max_iterations {
        if iters == 0 {
            diagnostics.push(
                Diagnostic::error("max-iterations must be positive")
                    .with_code("EMD504"),
            );
        }
    }

    if let Some(ms) = timeout_ms {
        if ms == 0 {
            diagnostics.push(
                Diagnostic::error("timeout must be positive")
                    .with_code("EMD505"),
            );
        }
    }

    if !edges.is_empty() && entry_node.is_some() {
        let mut reachable: HashSet<&str> = HashSet::new();
        let mut queue: Vec<&str> = vec![entry_node.as_ref().unwrap().as_str()];
        while let Some(node) = queue.pop() {
            if reachable.insert(node) {
                for (from, to) in &edges {
                    if from == node {
                        queue.push(to);
                    }
                }
            }
        }
        for node in &nodes {
            if !reachable.contains(node.as_str()) && node != "END" {
                diagnostics.push(
                    Diagnostic::warning(format!(
                        "Node '{}' is unreachable from entry point",
                        node
                    ))
                    .with_code("EMD506"),
                );
            }
        }
    }
}

pub fn validate_template_variables(section: &Section, diagnostics: &mut Vec<Diagnostic>) {
    for element in &section.content {
        if let SectionElement::Text(text) = element {
            let mut search_start = 0;
            while let Some(start) = text[search_start..].find("{{") {
                let abs_start = search_start + start;
                if let Some(end) = text[abs_start..].find("}}") {
                    let abs_end = abs_start + end;
                    let var_name = &text[abs_start + 2..abs_end];
                    if var_name.starts_with(|c: char| c.is_ascii_alphabetic() || c == '_')
                        && var_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
                    {
                        let known_vars = [
                            "task_title", "task_status", "task_deps", "file_name",
                            "section_title", "section_type", "current_date", "project_name",
                        ];
                        if !known_vars.contains(&var_name) {
                            diagnostics.push(
                                Diagnostic::info(format!(
                                    "Unknown template variable: '{{{{{}}}}}'",
                                    var_name
                                ))
                                .with_code("EMD600"),
                            );
                        }
                    }
                    search_start = abs_end + 2;
                } else {
                    break;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn test_broken_link_detected() {
        let source = "## [task|pending] Test\n\n[[nonexistent.emd]]";
        let doc = parse(source);
        let index = EmdIndex::new();
        let diags = validate(&doc, &index, false);
        let warnings: Vec<_> = diags.iter()
            .filter(|d| matches!(d.severity, DiagnosticSeverity::Warning))
            .collect();
        assert!(!warnings.is_empty());
    }

    #[test]
    fn test_context_validation() {
        let source = "## [summary] Overview\n\n\u{2192} param: thing";
        let doc = parse(source);
        let index = EmdIndex::new();
        let diags = validate(&doc, &index, false);
        let context_warnings: Vec<_> = diags.iter()
            .filter(|d| d.code.as_deref() == Some("EMD100"))
            .collect();
        assert!(!context_warnings.is_empty());
    }

    #[test]
    fn test_circular_dependency() {
        let source = "\
## [task|pending] A

\u{2192} depends: B

## [task|pending] B

\u{2192} depends: A
";
        let doc = parse(source);
        let index = EmdIndex::new();
        let diags = validate(&doc, &index, false);
        let errors: Vec<_> = diags.iter()
            .filter(|d| matches!(d.severity, DiagnosticSeverity::Error))
            .collect();
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_done_with_pending_dep() {
        let source = "\
## [task|done] A

\u{2192} depends: B

## [task|pending] B

Todo
";
        let doc = parse(source);
        let index = EmdIndex::new();
        let diags = validate(&doc, &index, false);
        let status_warnings: Vec<_> = diags.iter()
            .filter(|d| d.code.as_deref() == Some("EMD300"))
            .collect();
        assert!(!status_warnings.is_empty());
    }

    #[test]
    fn test_graph_validation() {
        let source = "\
## [graph] My Graph

\u{2192} node: start
\u{2192} node: middle
\u{2192} node: END
\u{2192} entry: start
\u{2192} edge: start -> middle
\u{2192} edge: middle -> END
";
        let doc = parse(source);
        let mut diags = Vec::new();
        validate_graph(&doc.sections[0], &mut diags);
        assert!(diags.is_empty());
    }

    #[test]
    fn test_graph_bad_edge() {
        let source = "\
## [graph] Bad Graph

\u{2192} node: start
\u{2192} node: END
\u{2192} entry: start
\u{2192} edge: start -> ghost
";
        let doc = parse(source);
        let mut diags = Vec::new();
        validate_graph(&doc.sections[0], &mut diags);
        assert!(!diags.is_empty());
    }

    #[test]
    fn test_valid_document_no_diagnostics() {
        let source = "\
## [task|pending] Build Feature

Write the code.

## [task|done] Setup

Project initialized.
";
        let doc = parse(source);
        let index = EmdIndex::new();
        let diags = validate(&doc, &index, false);
        let errors_warnings: Vec<_> = diags.iter()
            .filter(|d| matches!(d.severity, DiagnosticSeverity::Error | DiagnosticSeverity::Warning))
            .collect();
        assert!(errors_warnings.is_empty(),
            "Expected no errors/warnings but got: {:?}", errors_warnings);
    }
}
