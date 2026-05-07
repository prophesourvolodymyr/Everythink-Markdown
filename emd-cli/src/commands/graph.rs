use crate::GraphFormat;
use std::collections::HashSet;
use std::path::PathBuf;

pub fn run(path: PathBuf, format: GraphFormat) -> Result<(), String> {
    let index = emd::EmdIndex::build_from_dir(&path)?;

    // Collect all links across all files
    let mut nodes: HashSet<String> = HashSet::new();
    let mut edges: Vec<(String, String, String)> = Vec::new(); // (from, relation, to)

    for (file, sections) in &index.files {
        let basename = file.trim_end_matches(".emd").to_string();
        nodes.insert(basename.clone());

        for section in sections {
            for dep in &section.depends_on {
                let target = dep.trim_end_matches(".emd").to_string();
                edges.push((basename.clone(), "depends".to_string(), target.clone()));
                nodes.insert(target);
            }
        }
    }

    match format {
        GraphFormat::Dot => {
            println!("digraph EMD {{");
            println!("  rankdir=LR;");
            println!("  node [shape=box, style=rounded];");
            for node in &nodes {
                println!("  \"{}\";", node);
            }
            for (from, relation, to) in &edges {
                println!("  \"{}\" -> \"{}\" [label=\"{}\"];", from, to, relation);
            }
            println!("}}");
        }
        GraphFormat::Json => {
            let output = serde_json::json!({
                "nodes": nodes.iter().collect::<Vec<_>>(),
                "edges": edges.iter().map(|(f, r, t)| serde_json::json!({
                    "from": f,
                    "relation": r,
                    "to": t,
                })).collect::<Vec<_>>(),
            });
            println!("{}", serde_json::to_string_pretty(&output).unwrap());
        }
    }

    Ok(())
}
