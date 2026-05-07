use crate::QueryFormat;
use std::path::PathBuf;

pub fn run(query: String, path: PathBuf, format: QueryFormat, count_only: bool) -> Result<(), String> {
    let index = emd::EmdIndex::build_from_dir(&path)?;
    let loader = emd::ContextLoader::new(index);

    let parts: Vec<&str> = query.splitn(2, '|').collect();
    let type_str = parts[0];
    let status_str = parts.get(1).copied().unwrap_or("");

    let results: Vec<emd::SectionIndexEntry> = if !type_str.is_empty() && !status_str.is_empty() {
        let section_type = emd::SectionType::from_str(type_str);
        let status = emd::SectionStatus::from_str(status_str);
        loader
            .load_by_type(section_type)
            .into_iter()
            .filter(|s| s.status.as_ref() == Some(&status))
            .cloned()
            .collect()
    } else if !type_str.is_empty() {
        let section_type = emd::SectionType::from_str(type_str);
        loader.load_by_type(section_type).into_iter().cloned().collect()
    } else {
        return Err("Query must be 'type' or 'type|status'".to_string());
    };

    if count_only {
        match format {
            QueryFormat::Json => {
                println!("{}", serde_json::json!({ "count": results.len() }));
            }
            QueryFormat::Table => {
                println!("{}", results.len());
            }
        }
        return Ok(());
    }

    match format {
        QueryFormat::Json => {
            let output: Vec<serde_json::Value> = results
                .iter()
                .map(|s| {
                    serde_json::json!({
                        "file": s.file_path,
                        "type": s.section_type.as_str(),
                        "status": s.status.as_ref().map(|st| st.as_str()),
                        "title": s.title,
                    })
                })
                .collect();
            println!("{}", serde_json::to_string_pretty(&output).unwrap());
        }
        QueryFormat::Table => {
            for s in &results {
                println!(
                    "{:<20} {:<15} {:<12} {}",
                    s.file_path,
                    s.section_type.as_str(),
                    s.status.as_ref().map(|st| st.as_str()).unwrap_or_else(|| "?".to_string()),
                    s.title,
                );
            }
        }
    }

    Ok(())
}
