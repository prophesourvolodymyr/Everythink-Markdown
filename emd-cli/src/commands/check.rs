use crate::CheckFormat;
use std::path::PathBuf;

pub fn run(path: PathBuf, strict: bool, format: CheckFormat, quiet: bool) -> Result<(), String> {
    let index = emd::EmdIndex::build_from_dir(&path)?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for (file_path, _sections) in &index.files {
        let full_path = path.join(file_path);
        let content = std::fs::read_to_string(&full_path)
            .map_err(|e| format!("Cannot read {}: {}", file_path, e))?;
        let doc = emd::parse(&content);

        let diagnostics = emd::validate(&doc, &index, strict);
        for diag in diagnostics {
            match diag.severity {
                emd::DiagnosticSeverity::Error => {
                    errors.push((file_path.clone(), diag));
                }
                emd::DiagnosticSeverity::Warning => {
                    if strict {
                        errors.push((file_path.clone(), diag));
                    } else {
                        warnings.push((file_path.clone(), diag));
                    }
                }
                _ => {}
            }
        }
    }

    if quiet {
        if !errors.is_empty() {
            return Err(format!("{} error(s) found", errors.len()));
        }
        return Ok(());
    }

    match format {
        CheckFormat::Minimal => {
            for (file, diag) in &errors {
                println!(
                    "{}:{}: error: {} [{}]",
                    file,
                    diag.source_span.as_ref().map(|s| s.start_line).unwrap_or(1),
                    diag.message,
                    diag.code.as_deref().unwrap_or("EMD000"),
                );
            }
            for (file, diag) in &warnings {
                println!(
                    "{}:{}: warning: {} [{}]",
                    file,
                    diag.source_span.as_ref().map(|s| s.start_line).unwrap_or(1),
                    diag.message,
                    diag.code.as_deref().unwrap_or("EMD000"),
                );
            }
        }
        CheckFormat::Json => {
            let output = serde_json::json!({
                "errors": errors.iter().map(|(f, d)| serde_json::json!({
                    "file": f,
                    "line": d.source_span.as_ref().map(|s| s.start_line).unwrap_or(1),
                    "message": d.message,
                    "code": d.code,
                })).collect::<Vec<_>>(),
                "warnings": warnings.iter().map(|(f, d)| serde_json::json!({
                    "file": f,
                    "line": d.source_span.as_ref().map(|s| s.start_line).unwrap_or(1),
                    "message": d.message,
                    "code": d.code,
                })).collect::<Vec<_>>(),
            });
            println!("{}", serde_json::to_string_pretty(&output).unwrap());
        }
    }

    if !errors.is_empty() {
        return Err(format!("{} error(s) found", errors.len()));
    }
    Ok(())
}
