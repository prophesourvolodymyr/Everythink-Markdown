use crate::types::*;

pub fn serialize(doc: &EmdDocument) -> String {
    let mut output = String::new();
    for section in &doc.sections {
        serialize_section(section, &mut output, 0);
    }
    output
}

fn serialize_section(section: &Section, output: &mut String, indent_level: usize) {
    let hashes = "#".repeat(section.level as usize);

    let mut header = format!("{} [{}", hashes, section.section_type.as_str());
    if let Some(ref status) = section.status {
        header.push('|');
        header.push_str(&status.as_str());
    }
    header.push_str(&format!("] {}", section.title));

    output.push_str(&header);
    output.push('\n');
    output.push('\n');

    for element in &section.content {
        serialize_element(element, output);
    }

    if !section.subsections.is_empty() {
        if !section.content.is_empty() {
            output.push('\n');
        }
        for sub in &section.subsections {
            serialize_section(sub, output, indent_level + 1);
        }
    }
}

fn serialize_element(element: &SectionElement, output: &mut String) {
    match element {
        SectionElement::Text(text) => {
            if !text.is_empty() {
                output.push_str(text);
                output.push('\n');
                output.push('\n');
            }
        }
        SectionElement::Paragraph(text) => {
            output.push_str(text);
            output.push('\n');
            output.push('\n');
        }
        SectionElement::CodeBlock(cb) => {
            output.push_str("```");
            if let Some(ref tag) = cb.tag {
                output.push('[');
                output.push_str(tag.as_str());
                output.push(']');
            } else if let Some(ref lang) = cb.language {
                output.push_str(lang);
            }
            output.push('\n');
            output.push_str(&cb.content);
            output.push_str("\n```\n\n");
        }
        SectionElement::Link(link) => {
            output.push('\u{2192}');
            output.push(' ');
            output.push_str(link.relation.as_str());
            output.push_str(": ");
            output.push_str(&link.target);
            if let Some(ref condition) = link.condition {
                output.push_str(" [condition: ");
                output.push_str(condition);
                output.push(']');
            }
            output.push('\n');
        }
        SectionElement::WikiLink(wl) => {
            output.push_str("[[");
            output.push_str(&wl.target);
            if let Some(ref anchor) = wl.anchor {
                output.push('#');
                output.push_str(anchor);
            }
            output.push_str("]]\n");
        }
        SectionElement::Transclusion(tc) => {
            output.push_str("![[");
            output.push_str(&tc.target);
            if let Some(ref anchor) = tc.anchor {
                output.push('#');
                output.push_str(anchor);
            }
            output.push_str("]]\n");
        }
        SectionElement::MetadataComment(mc) => {
            output.push_str("<!-- ");
            output.push_str(&mc.key);
            output.push_str(": ");
            output.push_str(&mc.value);
            output.push_str(" -->\n");
        }
        SectionElement::List(items) => {
            for item in items {
                output.push_str("- ");
                serialize_element_inline(item, output);
                output.push('\n');
            }
            output.push('\n');
        }
        SectionElement::BlockQuote(text) => {
            output.push_str("> ");
            output.push_str(text);
            output.push('\n');
            output.push('\n');
        }
        SectionElement::Heading { level, text } => {
            let hashes = "#".repeat(*level as usize);
            output.push_str(&format!("{} {}\n\n", hashes, text));
        }
        SectionElement::HorizontalRule => {
            output.push_str("---\n\n");
        }
    }
}

fn serialize_element_inline(element: &SectionElement, output: &mut String) {
    match element {
        SectionElement::Text(text) | SectionElement::Paragraph(text) => {
            output.push_str(text);
        }
        SectionElement::WikiLink(wl) => {
            output.push_str("[[");
            output.push_str(&wl.target);
            if let Some(ref anchor) = wl.anchor {
                output.push('#');
                output.push_str(anchor);
            }
            output.push_str("]]");
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn test_roundtrip_simple() {
        let source = "## [task|pending] Build API\n\n\u{2192} depends: core.emd\n";
        let doc1 = parse(source);
        let serialized = serialize(&doc1);
        let doc2 = parse(&serialized);
        assert_eq!(doc1.sections.len(), doc2.sections.len());
        assert_eq!(doc1.sections[0].section_type, doc2.sections[0].section_type);
        assert_eq!(doc1.sections[0].title, doc2.sections[0].title);
    }

    #[test]
    fn test_roundtrip_all_types() {
        let source = "\
## [summary] Overview

Brief summary here.

## [task|done] Completed Task

Finished!

## [task|pending] Todo

\u{2192} depends: other.emd

## [task|blocked: waiting] Stuck

Cannot proceed

## [task|in-progress] Working

Almost there
";
        let doc1 = parse(source);
        let serialized = serialize(&doc1);
        let doc2 = parse(&serialized);
        assert_eq!(doc1.sections.len(), doc2.sections.len());
    }

    #[test]
    fn test_roundtrip_code_blocks() {
        let source = "## [verify] Tests\n\n```[verify]\ncargo test\n```\n";
        let doc1 = parse(source);
        let serialized = serialize(&doc1);
        let doc2 = parse(&serialized);

        let cb1: Vec<_> = doc1.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::CodeBlock(c) = e { Some(c) } else { None })
            .collect();
        let cb2: Vec<_> = doc2.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::CodeBlock(c) = e { Some(c) } else { None })
            .collect();
        assert_eq!(cb1.len(), 1);
        assert_eq!(cb2.len(), 1);
        assert_eq!(cb1[0].tag, cb2[0].tag);
        assert_eq!(cb1[0].content.trim(), cb2[0].content.trim());
    }

    #[test]
    fn test_roundtrip_wiki_links() {
        let source = "## [summary] Ref\n\nSee [[file.emd#anchor]] and ![[other.emd]]\n";
        let doc1 = parse(source);
        let serialized = serialize(&doc1);
        let doc2 = parse(&serialized);

        let wl1: Vec<_> = doc2.sections[0].content.iter()
            .filter_map(|e| if let SectionElement::WikiLink(w) = e { Some(w) } else { None })
            .collect();
        assert!(!wl1.is_empty());
    }
}
