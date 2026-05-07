use std::path::PathBuf;

pub fn run(path: PathBuf, check_only: bool) -> Result<(), String> {
    if path.is_file() {
        let changed = format_file(&path, check_only)?;
        if check_only && changed {
            return Err("File needs formatting".to_string());
        }
        Ok(())
    } else if path.is_dir() {
        let mut had_changes = false;
        for entry in walkdir::WalkDir::new(&path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()) == Some("emd") {
                let changed = format_file(p, check_only)?;
                if changed {
                    had_changes = true;
                }
            }
        }
        if check_only && had_changes {
            return Err("Some files need formatting".to_string());
        }
        Ok(())
    } else {
        Err(format!("Path not found: {}", path.display()))
    }
}

fn format_file(path: &std::path::Path, check_only: bool) -> Result<bool, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
    let doc = emd::parse(&content);
    let formatted = emd::serialize(&doc);
    let normalized = normalize_formatting(&formatted);
    let current = normalize_formatting(&content);

    if normalized != current {
        if check_only {
            return Ok(true);
        }
        std::fs::write(path, &normalized)
            .map_err(|e| format!("Cannot write {}: {}", path.display(), e))?;
        println!("Formatted: {}", path.display());
        return Ok(true);
    }
    Ok(false)
}

fn normalize_formatting(text: &str) -> String {
    let mut result = String::new();
    let mut last_was_blank = false;

    for line in text.lines() {
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            if !last_was_blank {
                result.push('\n');
                last_was_blank = true;
            }
        } else {
            result.push_str(trimmed);
            result.push('\n');
            last_was_blank = false;
        }
    }

    result.trim_end().to_string() + "\n"
}
