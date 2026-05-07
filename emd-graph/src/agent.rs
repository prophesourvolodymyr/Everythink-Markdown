use crate::{AgentConfig, ExecutionStatus, NodeResult};
use std::time::Duration;
use tokio::time::timeout;

#[derive(Debug, Clone)]
pub enum AgentAction {
    Think(String),
    Act { tool: String, input: String },
    Observe(String),
    Done { output: String },
}

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub task: String,
    pub persona: Option<String>,
    pub tools: Vec<String>,
    pub max_iterations: usize,
}

pub struct ReActAgent;

impl ReActAgent {
    pub async fn execute(
        config: &AgentConfig,
        task: &str,
        timeout_duration: Duration,
    ) -> Result<NodeResult, String> {
        let ctx = AgentContext {
            task: task.to_string(),
            persona: config.persona.clone(),
            tools: config.tools.clone(),
            max_iterations: 5,
        };

        let start = std::time::Instant::now();
        let mut iteration = 0;
        let mut output = String::new();

        let result = timeout(timeout_duration, async {
            loop {
                if iteration >= ctx.max_iterations {
                    break;
                }

                let action = Self::reason(&ctx, &output, iteration);
                match action {
                    AgentAction::Think(thought) => {
                        output.push_str(&format!("[Think] {}\n", thought));
                    }
                    AgentAction::Act { tool, input } => {
                        output.push_str(&format!("[Act] {}: {}\n", tool, input));
                        let observation = Self::observe(&tool, &input);
                        output.push_str(&format!("[Observe] {}\n", observation));
                    }
                    AgentAction::Observe(obs) => {
                        output.push_str(&format!("[Observe] {}\n", obs));
                    }
                    AgentAction::Done { output: done_output } => {
                        output.push_str(&done_output);
                        break;
                    }
                }

                iteration += 1;
            }
        })
        .await;

        let duration_ms = start.elapsed().as_millis() as u64;
        let (status, error) = match result {
            Ok(_) => (ExecutionStatus::Success, None),
            Err(_) => (ExecutionStatus::Timeout, Some("Execution timed out".to_string())),
        };

        Ok(NodeResult {
            node: config.name.clone(),
            status,
            output: Some(output),
            error,
            tokens_used: 0,
            duration_ms,
        })
    }

    fn reason(ctx: &AgentContext, _history: &str, iteration: usize) -> AgentAction {
        if iteration == 0 {
            let thought = format!(
                "I need to complete the task: {}. Available tools: {:?}",
                ctx.task, ctx.tools
            );
            AgentAction::Think(thought)
        } else if iteration >= ctx.max_iterations - 1 {
            AgentAction::Done {
                output: format!("Task '{}' completed after {} iterations.", ctx.task, iteration + 1),
            }
        } else {
            AgentAction::Done {
                output: format!("Task '{}' completed.", ctx.task),
            }
        }
    }

    fn observe(tool: &str, input: &str) -> String {
        match tool {
            "read_file" => format!("File content would be returned for: {}", input),
            "write_file" => format!("File written: {}", input),
            "search_code" => format!("Search results for: {}", input),
            _ => format!("Tool '{}' executed with input: {}", tool, input),
        }
    }
}

pub struct ToolAgent;

impl ToolAgent {
    pub async fn execute(
        config: &AgentConfig,
        task: &str,
        _timeout_duration: Duration,
    ) -> Result<NodeResult, String> {
        let start = std::time::Instant::now();

        let output = format!(
            "[ToolAgent] Executing task: '{}' with tools: {:?}",
            task, config.tools
        );

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(NodeResult {
            node: config.name.clone(),
            status: ExecutionStatus::Success,
            output: Some(output),
            error: None,
            tokens_used: 0,
            duration_ms,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_react_agent_completes_task() {
        let config = AgentConfig {
            name: "test-agent".to_string(),
            model: "gpt-4o".to_string(),
            persona: Some("Tester".to_string()),
            tools: vec!["read_file".to_string()],
            memory_store: None,
            max_tokens: None,
        };

        let result = ReActAgent::execute(
            &config,
            "Check if file exists",
            Duration::from_secs(5),
        )
        .await
        .unwrap();

        assert_eq!(result.status, ExecutionStatus::Success);
        assert!(result.output.is_some());
        assert!(result.error.is_none());
    }

    #[tokio::test]
    async fn test_tool_agent_completes() {
        let config = AgentConfig {
            name: "tool-agent".to_string(),
            model: "gpt-4o".to_string(),
            persona: None,
            tools: vec!["search_code".to_string()],
            memory_store: None,
            max_tokens: None,
        };

        let result = ToolAgent::execute(&config, "Search for TODO", Duration::from_secs(5))
            .await
            .unwrap();

        assert_eq!(result.status, ExecutionStatus::Success);
        assert!(result.output.is_some());
    }
}
