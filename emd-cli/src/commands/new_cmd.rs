pub fn run(name: String, template: Option<String>, list: bool) -> Result<(), String> {
    if list {
        println!("Available templates:");
        println!("  default  — Standard project with AGENTS.emd + CYCLES.emd");
        println!("  docs     — Documentation project");
        println!("  tasks    — Task tracking project");
        return Ok(());
    }

    let dir = std::path::PathBuf::from(&name);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create directory '{}': {}", name, e))?;

    let template_name = template.unwrap_or_else(|| "default".to_string());

    match template_name.as_str() {
        "default" => scaffold_default(&dir)?,
        "docs" => scaffold_docs(&dir)?,
        "tasks" => scaffold_tasks(&dir)?,
        other => return Err(format!("Unknown template: '{}'. Use --list to see available templates.", other)),
    }

    println!("Created EMD project at: {}", dir.display());
    println!("  {}", dir.join("AGENTS.emd").display());
    println!("  {}", dir.join("CYCLES.emd").display());

    Ok(())
}

fn scaffold_default(dir: &std::path::Path) -> Result<(), String> {
    let agents = r#"## [summary] AGENTS
This is the agent configuration for this project.

## [agent] Default Agent
→ model: gpt-4o
→ persona: Helpful coding assistant
→ memory: local

## [human] Notes
Add your notes, questions, and design thoughts here.
"#;

    let cycles = r#"## [summary] CYCLES
Project cycles and task tracking.

## [task|pending] Phase 1 Setup
Initialize the project structure.

## [task|pending] Phase 2 Core
Implement core features.

## [task|pending] Phase 3 Polish
Refine and ship.
"#;

    std::fs::write(dir.join("AGENTS.emd"), agents)
        .map_err(|e| format!("{}", e))?;
    std::fs::write(dir.join("CYCLES.emd"), cycles)
        .map_err(|e| format!("{}", e))?;
    Ok(())
}

fn scaffold_docs(dir: &std::path::Path) -> Result<(), String> {
    let readme = r#"## [summary] Documentation
Project documentation.

## [detail] Overview
Detailed overview of the project.

## [detail] API Reference
API documentation and examples.

## [detail] Architecture
System design and decisions.
"#;
    std::fs::write(dir.join("README.emd"), readme)
        .map_err(|e| format!("{}", e))?;
    Ok(())
}

fn scaffold_tasks(dir: &std::path::Path) -> Result<(), String> {
    let tasks = r#"## [summary] Task Board
Project task tracking board.

## [task|pending] Backlog Item 1
→ depends: Prerequisite

## [task|in-progress] Active Task
Working on this now.

## [task|done] Completed Task
Finished successfully.

## [task|blocked: dependency] Blocked Task
Waiting for external dependency.
"#;
    std::fs::write(dir.join("TASKS.emd"), tasks)
        .map_err(|e| format!("{}", e))?;
    Ok(())
}
