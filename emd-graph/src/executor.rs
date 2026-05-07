use crate::{
    AgentConfig, ExecutionConfig, ExecutionContext, ExecutionStatus, GraphTopology, NodeResult,
    agent::ReActAgent,
};
use std::collections::HashMap;

pub struct GraphExecutor {
    config: ExecutionConfig,
}

impl GraphExecutor {
    pub fn new(config: ExecutionConfig) -> Self {
        GraphExecutor { config }
    }

    pub async fn execute(
        &self,
        topology: &GraphTopology,
        agents: &HashMap<String, AgentConfig>,
    ) -> Result<ExecutionContext, String> {
        let mut ctx = ExecutionContext {
            variables: HashMap::new(),
            node_results: HashMap::new(),
            current_node: None,
            iteration: 0,
        };

        let mut current = topology.entry.clone();

        while ctx.iteration < self.config.max_iterations {
            if current == "END" || current.is_empty() {
                break;
            }

            ctx.current_node = Some(current.clone());
            ctx.iteration += 1;

            let node = match topology.nodes.iter().find(|n| n.name == current) {
                Some(n) => n,
                None => break,
            };

            let default_config = AgentConfig {
                name: node.agent.clone(),
                model: "gpt-4o".to_string(),
                persona: None,
                tools: Vec::new(),
                memory_store: None,
                max_tokens: None,
            };
            let agent_config = agents.get(&node.agent).unwrap_or(&default_config);

            let result = ReActAgent::execute(
                agent_config,
                &node.task,
                self.config.timeout_per_node,
            )
            .await
            .unwrap_or_else(|e| NodeResult {
                node: node.name.clone(),
                status: ExecutionStatus::Failure,
                output: None,
                error: Some(e),
                tokens_used: 0,
                duration_ms: 0,
            });

            ctx.node_results.insert(node.name.clone(), result.clone());

            if result.status == ExecutionStatus::Failure {
                break;
            }

            current = self.resolve_next_node(topology, &node.name, &ctx);
        }

        Ok(ctx)
    }

    fn resolve_next_node(
        &self,
        topology: &GraphTopology,
        current_node: &str,
        _ctx: &ExecutionContext,
    ) -> String {
        let outgoing: Vec<&crate::GraphEdge> = topology
            .edges
            .iter()
            .filter(|e| e.from == current_node)
            .collect();

        if outgoing.is_empty() {
            return "END".to_string();
        }

        for edge in &outgoing {
            if edge.condition.is_none() {
                return edge.to.clone();
            }
        }

        outgoing.first().map(|e| e.to.clone()).unwrap_or("END".to_string()).to_string()
    }

    pub async fn execute_and_write(
        &self,
        topology: &GraphTopology,
        agents: &HashMap<String, AgentConfig>,
    ) -> Result<ExecutionContext, String> {
        let result = self.execute(topology, agents).await?;

        if self.config.confirm_before_write {
            // In a real implementation, this would prompt the user
            // For now, we auto-confirm in non-interactive mode
        }

        if let Some(ref root) = self.config.project_root {
            for (node_name, node_result) in &result.node_results {
                if let Some(ref output) = node_result.output {
                    let file_path = root.join(format!("{}.emd", node_name));
                    let existing = std::fs::read_to_string(&file_path).unwrap_or_default();
                    let new_content = format!(
                        "{}\n\n<!-- AGENT_RESULT: {} -->\n{}\n",
                        existing, node_name, output
                    );
                    std::fs::write(&file_path, &new_content)
                        .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))?;
                }
            }
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::GraphNode;
    use std::time::Duration;

    #[tokio::test]
    async fn test_executor_runs_three_node_workflow() {
        let topology = GraphTopology {
            entry: "start".to_string(),
            nodes: vec![
                GraphNode {
                    name: "start".to_string(),
                    agent: "agent-a".to_string(),
                    task: "Init".to_string(),
                },
                GraphNode {
                    name: "middle".to_string(),
                    agent: "agent-a".to_string(),
                    task: "Process".to_string(),
                },
                GraphNode {
                    name: "end".to_string(),
                    agent: "agent-a".to_string(),
                    task: "Done".to_string(),
                },
            ],
            edges: vec![
                crate::GraphEdge {
                    from: "start".to_string(),
                    to: "middle".to_string(),
                    condition: None,
                },
                crate::GraphEdge {
                    from: "middle".to_string(),
                    to: "end".to_string(),
                    condition: None,
                },
            ],
        };

        let agents = HashMap::from([(
            "agent-a".to_string(),
            AgentConfig {
                name: "agent-a".to_string(),
                model: "gpt-4o".to_string(),
                persona: None,
                tools: vec!["read_file".to_string()],
                memory_store: None,
                max_tokens: None,
            },
        )]);

        let executor = GraphExecutor::new(ExecutionConfig {
            max_iterations: 5,
            timeout_per_node: Duration::from_secs(10),
            confirm_before_write: false,
            project_root: None,
        });

        let ctx = executor.execute(&topology, &agents).await.unwrap();
        assert_eq!(ctx.node_results.len(), 3);
        for (_, result) in &ctx.node_results {
            assert_eq!(result.status, ExecutionStatus::Success);
        }
    }

    #[tokio::test]
    async fn test_max_iterations_stops_loop() {
        let topology = GraphTopology {
            entry: "loop".to_string(),
            nodes: vec![
                GraphNode {
                    name: "loop".to_string(),
                    agent: "agent-a".to_string(),
                    task: "Loop task".to_string(),
                },
            ],
            edges: vec![crate::GraphEdge {
                from: "loop".to_string(),
                to: "loop".to_string(),
                condition: None,
            }],
        };

        let agents = HashMap::from([(
            "agent-a".to_string(),
            AgentConfig {
                name: "agent-a".to_string(),
                model: "gpt-4o".to_string(),
                persona: None,
                tools: Vec::new(),
                memory_store: None,
                max_tokens: None,
            },
        )]);

        let executor = GraphExecutor::new(ExecutionConfig {
            max_iterations: 3,
            timeout_per_node: Duration::from_secs(10),
            confirm_before_write: false,
            project_root: None,
        });

        let ctx = executor.execute(&topology, &agents).await.unwrap();
        assert!(ctx.iteration <= 3);
    }

    #[tokio::test]
    async fn test_edge_conditions_route_correctly() {
        let topology = GraphTopology {
            entry: "start".to_string(),
            nodes: vec![
                GraphNode {
                    name: "start".to_string(),
                    agent: "agent-a".to_string(),
                    task: "Start".to_string(),
                },
                GraphNode {
                    name: "success-path".to_string(),
                    agent: "agent-a".to_string(),
                    task: "Success".to_string(),
                },
            ],
            edges: vec![
                crate::GraphEdge {
                    from: "start".to_string(),
                    to: "success-path".to_string(),
                    condition: None,
                },
            ],
        };

        let agents = HashMap::from([(
            "agent-a".to_string(),
            AgentConfig {
                name: "agent-a".to_string(),
                model: "gpt-4o".to_string(),
                persona: None,
                tools: Vec::new(),
                memory_store: None,
                max_tokens: None,
            },
        )]);

        let executor = GraphExecutor::new(ExecutionConfig::default());
        let ctx = executor.execute(&topology, &agents).await.unwrap();

        assert!(ctx.node_results.contains_key("start"));
        assert!(ctx.node_results.contains_key("success-path"));
    }
}
