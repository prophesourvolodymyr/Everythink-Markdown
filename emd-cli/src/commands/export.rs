use crate::ExportFormat;
use std::path::PathBuf;

pub fn run(path: PathBuf, format: ExportFormat, output: Option<PathBuf>) -> Result<(), String> {
    if path.is_file() {
        export_file(&path, &format, &output)
    } else if path.is_dir() {
        export_dir(&path, &format, &output)
    } else {
        Err(format!("Path not found: {}", path.display()))
    }
}

fn export_file(path: &PathBuf, format: &ExportFormat, output: &Option<PathBuf>) -> Result<(), String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
    let doc = emd::parse(&content);

    let result = match format {
        ExportFormat::Json => {
            serde_json::to_string_pretty(&doc).map_err(|e| format!("JSON error: {}", e))?
        }
        ExportFormat::Md => {
            strip_emd_annotations(&content)
        }
        ExportFormat::Html => {
            markdown_to_html(&content)
        }
        ExportFormat::Dot => {
            let mut dot = String::from("digraph EMD {\n  rankdir=LR;\n");
            let node_name = path.file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("doc");
            dot.push_str(&format!("  \"{}\" [shape=box];\n", node_name));
            for section in &doc.sections {
                if !section.diagnostics.is_empty() {
                    // skip
                }
                for element in &section.content {
                    if let emd::SectionElement::Link(link) = element {
                        dot.push_str(&format!(
                            "  \"{}\" -> \"{}\" [label=\"{}\"];\n",
                            node_name,
                            link.target,
                            link.relation.as_str(),
                        ));
                    }
                }
            }
            dot.push_str("}\n");
            dot
        }
        ExportFormat::Static => {
            let mut html = String::from("<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\">");
            html.push_str("<title>EMD Export</title></head><body>\n");
            html.push_str(&markdown_to_html(&content));
            html.push_str("</body></html>\n");
            html
        }
    };

    if let Some(out_dir) = output {
        std::fs::create_dir_all(out_dir).map_err(|e| format!("{}", e))?;
        let out_path = if out_dir.is_dir() {
            let stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("output");
            let ext = match format {
                ExportFormat::Json | ExportFormat::Dot => "json",
                ExportFormat::Html | ExportFormat::Static => "html",
                ExportFormat::Md => "md",
            };
            out_dir.join(format!("{}.{}", stem, ext))
        } else {
            out_dir.clone()
        };
        std::fs::write(&out_path, &result).map_err(|e| format!("Cannot write: {}", e))?;
        println!("Exported to: {}", out_path.display());
    } else {
        println!("{}", result);
    }

    Ok(())
}

fn export_dir(path: &PathBuf, format: &ExportFormat, output: &Option<PathBuf>) -> Result<(), String> {
    if matches!(format, ExportFormat::Static) {
        let mut html = String::from("<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\">");
        html.push_str("<title>EMD Project</title></head><body>\n");
        html.push_str("<h1>EMD Project Export</h1>\n");

        for entry in walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()) == Some("emd") {
                let content = std::fs::read_to_string(p)
                    .map_err(|e| format!("{}: {}", p.display(), e))?;
                html.push_str(&format!("<h2>{}</h2>\n", p.display()));
                html.push_str(&markdown_to_html(&content));
            }
        }
        html.push_str("</body></html>\n");

        let out_path = output.as_ref()
            .cloned()
            .unwrap_or_else(|| PathBuf::from("index.html"));
        std::fs::write(&out_path, &html).map_err(|e| format!("Cannot write: {}", e))?;
        println!("Exported to: {}", out_path.display());
    } else {
        for entry in walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let p = entry.path().to_path_buf();
            if p.extension().and_then(|e| e.to_str()) == Some("emd") {
                export_file(&p, format, output)?;
            }
        }
    }
    Ok(())
}

fn strip_emd_annotations(source: &str) -> String {
    let re = regex::Regex::new(r"^##\s*\[[^\]]+]\s*").unwrap();
    re.replace_all(source, "## ").to_string()
}

fn markdown_to_html(source: &str) -> String {
    let mut html = String::new();
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("## ") || trimmed.starts_with("# ") {
            let level = if trimmed.starts_with("# ") { 1 } else { 2 };
            let text = trimmed.trim_start_matches('#').trim();
            html.push_str(&format!("<h{}>{}</h{}>\n", level, escape_html(text), level));
        } else if trimmed.starts_with("```") {
            if html.ends_with("</code></pre>\n") {
                html.push_str("</code></pre>\n");
            } else {
                html.push_str("<pre><code>");
            }
        } else if trimmed.starts_with('\u{2192}') {
            let link_text = escape_html(trimmed);
            html.push_str(&format!("<p><em>{}</em></p>\n", link_text));
        } else if !trimmed.is_empty() {
            html.push_str(&format!("<p>{}</p>\n", escape_html(trimmed)));
        }
    }
    html
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
