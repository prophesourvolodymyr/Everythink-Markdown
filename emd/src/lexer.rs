use logos::Logos;

#[derive(Logos, Debug, PartialEq, Clone)]
#[logos(skip r"[ \t]+")]
pub enum Token {
    #[regex(r"#{2,6} (?:\[[^\]]+\] )?[^\n]*")]
    SectionHeader,

    #[regex(r"#[^#\n][^\n]*")]
    H1Heading,

    #[token("\u{2192}")]
    LinkArrow,

    #[regex(r"!\[\[[^\]]+\]\]")]
    Transclusion,

    #[regex(r"\[\[[^\]]+\]\]")]
    WikiLink,

    #[regex(r"<!--[^>]*-->")]
    MetadataComment,

    #[regex(r"```[^\n]*")]
    CodeFence,

    #[regex(r"\n+")]
    Newline,

    #[regex(r"[^#→\[!`<\n \t]+")]
    Text,
}

pub fn tokenize(source: &str) -> Vec<(Token, String)> {
    Token::lexer(source)
        .spanned()
        .map(|(tok, span)| {
            let text = source[span].to_string();
            (tok.unwrap_or(Token::Text), text)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_section_header() {
        let tokens = tokenize("## [task|done] Hello World\n");
        let headers: Vec<_> = tokens.iter().filter(|(t, _)| matches!(t, Token::SectionHeader)).collect();
        assert_eq!(headers.len(), 1);
    }

    #[test]
    fn test_tokenize_link_arrow() {
        let tokens = tokenize("\u{2192} depends: target\n");
        let arrows: Vec<_> = tokens.iter().filter(|(t, _)| matches!(t, Token::LinkArrow)).collect();
        assert_eq!(arrows.len(), 1);
    }

    #[test]
    fn test_tokenize_wiki_link() {
        let tokens = tokenize("See [[file.emd#anchor]] here\n");
        let wikis: Vec<_> = tokens.iter().filter(|(t, _)| matches!(t, Token::WikiLink)).collect();
        assert_eq!(wikis.len(), 1);
    }

    #[test]
    fn test_tokenize_transclusion() {
        let tokens = tokenize("Load ![[./file.emd#Section]] now\n");
        let trans: Vec<_> = tokens.iter().filter(|(t, _)| matches!(t, Token::Transclusion)).collect();
        assert_eq!(trans.len(), 1);
    }
}
