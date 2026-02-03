//! 搜索查询解析器
//!
//! 支持的语法：
//! - `canon AND 风景` - 布尔 AND
//! - `canon OR nikon` - 布尔 OR
//! - `NOT 人像` - 布尔 NOT
//! - `"北京天安门"` - 精确短语匹配
//! - `camera:Canon` - 字段限定搜索
//! - `tag:风景` - 标签搜索
//! - `iso:>800` - 数值范围搜索
//! - `photo*.jpg` - 通配符匹配

/// 搜索查询 AST 节点
#[derive(Debug, Clone, PartialEq)]
pub enum QueryNode {
    /// 简单词项（前缀匹配）
    Term(String),
    /// 精确短语 "exact phrase"
    Phrase(String),
    /// 字段限定 field:value
    Field {
        field: String,
        value: Box<QueryNode>,
        operator: FieldOperator,
    },
    /// 布尔 AND
    And(Vec<QueryNode>),
    /// 布尔 OR
    Or(Vec<QueryNode>),
    /// 布尔 NOT
    Not(Box<QueryNode>),
    /// 通配符 (*, ?)
    Wildcard(String),
}

/// 字段操作符
#[derive(Debug, Clone, PartialEq)]
pub enum FieldOperator {
    /// 等于 (默认)
    Eq,
    /// 大于
    Gt,
    /// 大于等于
    Gte,
    /// 小于
    Lt,
    /// 小于等于
    Lte,
}

/// 字段过滤条件
#[derive(Debug, Clone)]
pub struct FieldFilter {
    pub field: String,
    pub value: String,
    pub operator: FieldOperator,
}

/// 解析结果
#[derive(Debug, Clone, Default)]
pub struct ParsedQuery {
    /// FTS5 查询部分
    pub fts_query: Option<String>,
    /// 字段过滤条件
    pub field_filters: Vec<FieldFilter>,
    /// 标签名称列表
    pub tag_names: Vec<String>,
    /// 是否有效查询
    pub is_valid: bool,
}

/// 词法单元
#[derive(Debug, Clone, PartialEq)]
enum Token {
    /// 普通词
    Word(String),
    /// 引号短语
    Phrase(String),
    /// AND 运算符
    And,
    /// OR 运算符
    Or,
    /// NOT 运算符
    Not,
    /// 左括号
    LParen,
    /// 右括号
    RParen,
    /// 字段限定符 field:
    Field(String),
    /// 操作符 (>, <, >=, <=)
    Operator(FieldOperator),
}

/// 查询解析器
pub struct QueryParser;

impl QueryParser {
    /// 解析用户输入的搜索查询
    pub fn parse(input: &str) -> ParsedQuery {
        let input = input.trim();
        if input.is_empty() {
            return ParsedQuery::default();
        }

        // 词法分析
        let tokens = Self::tokenize(input);
        if tokens.is_empty() {
            return ParsedQuery::default();
        }

        // 语法分析
        let mut parser = Parser::new(tokens);
        let ast = parser.parse_expression();

        // 转换为查询结果
        Self::ast_to_query(ast)
    }

    /// 词法分析
    fn tokenize(input: &str) -> Vec<Token> {
        let mut tokens = Vec::new();
        let mut chars = input.chars().peekable();

        while let Some(&ch) = chars.peek() {
            match ch {
                // 跳过空白
                ' ' | '\t' | '\n' | '\r' => {
                    chars.next();
                }
                // 引号短语
                '"' => {
                    chars.next();
                    let mut phrase = String::new();
                    while let Some(&c) = chars.peek() {
                        if c == '"' {
                            chars.next();
                            break;
                        }
                        phrase.push(c);
                        chars.next();
                    }
                    if !phrase.is_empty() {
                        tokens.push(Token::Phrase(phrase));
                    }
                }
                // 括号
                '(' => {
                    chars.next();
                    tokens.push(Token::LParen);
                }
                ')' => {
                    chars.next();
                    tokens.push(Token::RParen);
                }
                // 操作符
                '>' | '<' => {
                    chars.next();
                    if chars.peek() == Some(&'=') {
                        chars.next();
                        tokens.push(Token::Operator(if ch == '>' {
                            FieldOperator::Gte
                        } else {
                            FieldOperator::Lte
                        }));
                    } else {
                        tokens.push(Token::Operator(if ch == '>' {
                            FieldOperator::Gt
                        } else {
                            FieldOperator::Lt
                        }));
                    }
                }
                // 词或字段
                _ => {
                    let mut word = String::new();
                    while let Some(&c) = chars.peek() {
                        if c.is_whitespace() || c == '(' || c == ')' || c == '"' {
                            break;
                        }
                        word.push(c);
                        chars.next();
                    }

                    if word.is_empty() {
                        continue;
                    }

                    // 检查是否是布尔运算符
                    let upper = word.to_uppercase();
                    match upper.as_str() {
                        "AND" | "&&" => tokens.push(Token::And),
                        "OR" | "||" => tokens.push(Token::Or),
                        "NOT" | "-" => tokens.push(Token::Not),
                        _ => {
                            // 检查是否是字段限定符
                            if let Some(colon_pos) = word.find(':') {
                                let field = word[..colon_pos].to_lowercase();
                                let value = word[colon_pos + 1..].to_string();

                                // 已知字段列表
                                let known_fields = [
                                    "camera", "lens", "tag", "iso", "f", "aperture",
                                    "focal", "rating", "date", "path", "name", "format",
                                ];

                                if known_fields.contains(&field.as_str()) {
                                    tokens.push(Token::Field(field));
                                    if !value.is_empty() {
                                        // 检查值是否以操作符开头
                                        if value.starts_with(">=") {
                                            tokens.push(Token::Operator(FieldOperator::Gte));
                                            tokens.push(Token::Word(value[2..].to_string()));
                                        } else if value.starts_with("<=") {
                                            tokens.push(Token::Operator(FieldOperator::Lte));
                                            tokens.push(Token::Word(value[2..].to_string()));
                                        } else if value.starts_with('>') {
                                            tokens.push(Token::Operator(FieldOperator::Gt));
                                            tokens.push(Token::Word(value[1..].to_string()));
                                        } else if value.starts_with('<') {
                                            tokens.push(Token::Operator(FieldOperator::Lt));
                                            tokens.push(Token::Word(value[1..].to_string()));
                                        } else {
                                            tokens.push(Token::Word(value));
                                        }
                                    }
                                } else {
                                    // 不是已知字段，作为普通词处理
                                    tokens.push(Token::Word(word));
                                }
                            } else {
                                tokens.push(Token::Word(word));
                            }
                        }
                    }
                }
            }
        }

        tokens
    }

    /// 将 AST 转换为查询结果
    fn ast_to_query(ast: Option<QueryNode>) -> ParsedQuery {
        let mut result = ParsedQuery {
            fts_query: None,
            field_filters: Vec::new(),
            tag_names: Vec::new(),
            is_valid: false,
        };

        if let Some(node) = ast {
            let mut fts_parts = Vec::new();
            Self::collect_query_parts(&node, &mut fts_parts, &mut result.field_filters, &mut result.tag_names);

            if !fts_parts.is_empty() {
                result.fts_query = Some(fts_parts.join(" "));
            }
            result.is_valid = true;
        }

        result
    }

    /// 递归收集查询部分
    fn collect_query_parts(
        node: &QueryNode,
        fts_parts: &mut Vec<String>,
        field_filters: &mut Vec<FieldFilter>,
        tag_names: &mut Vec<String>,
    ) {
        match node {
            QueryNode::Term(term) => {
                // 转义 FTS5 特殊字符并添加前缀匹配
                let escaped = Self::escape_fts5(term);
                fts_parts.push(format!("{}*", escaped));
            }
            QueryNode::Phrase(phrase) => {
                let escaped = Self::escape_fts5(phrase);
                fts_parts.push(format!("\"{}\"", escaped));
            }
            QueryNode::Wildcard(pattern) => {
                // FTS5 只支持前缀通配符
                let escaped = pattern.replace('?', "_").replace('*', "*");
                fts_parts.push(escaped);
            }
            QueryNode::Field { field, value, operator } => {
                // 特殊处理 tag 字段
                if field == "tag" {
                    if let QueryNode::Term(tag_name) | QueryNode::Phrase(tag_name) = value.as_ref() {
                        tag_names.push(tag_name.clone());
                    }
                } else {
                    let value_str = match value.as_ref() {
                        QueryNode::Term(v) | QueryNode::Phrase(v) => v.clone(),
                        _ => return,
                    };
                    field_filters.push(FieldFilter {
                        field: field.clone(),
                        value: value_str,
                        operator: operator.clone(),
                    });
                }
            }
            QueryNode::And(nodes) => {
                let mut sub_parts = Vec::new();
                for n in nodes {
                    let mut node_parts = Vec::new();
                    Self::collect_query_parts(n, &mut node_parts, field_filters, tag_names);
                    if !node_parts.is_empty() {
                        sub_parts.push(node_parts.join(" "));
                    }
                }
                if !sub_parts.is_empty() {
                    fts_parts.push(format!("({})", sub_parts.join(" AND ")));
                }
            }
            QueryNode::Or(nodes) => {
                let mut sub_parts = Vec::new();
                for n in nodes {
                    let mut node_parts = Vec::new();
                    Self::collect_query_parts(n, &mut node_parts, field_filters, tag_names);
                    if !node_parts.is_empty() {
                        sub_parts.push(node_parts.join(" "));
                    }
                }
                if !sub_parts.is_empty() {
                    fts_parts.push(format!("({})", sub_parts.join(" OR ")));
                }
            }
            QueryNode::Not(inner) => {
                let mut inner_parts = Vec::new();
                Self::collect_query_parts(inner, &mut inner_parts, field_filters, tag_names);
                if !inner_parts.is_empty() {
                    fts_parts.push(format!("NOT {}", inner_parts.join(" ")));
                }
            }
        }
    }

    /// 转义 FTS5 特殊字符
    fn escape_fts5(s: &str) -> String {
        s.replace('"', "\"\"")
    }
}

/// 语法分析器
struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<Token> {
        if self.pos < self.tokens.len() {
            let token = self.tokens[self.pos].clone();
            self.pos += 1;
            Some(token)
        } else {
            None
        }
    }

    /// 解析表达式 (处理 OR)
    fn parse_expression(&mut self) -> Option<QueryNode> {
        let mut left = self.parse_and_expression()?;

        while matches!(self.peek(), Some(Token::Or)) {
            self.advance(); // consume OR
            if let Some(right) = self.parse_and_expression() {
                left = match left {
                    QueryNode::Or(mut nodes) => {
                        nodes.push(right);
                        QueryNode::Or(nodes)
                    }
                    _ => QueryNode::Or(vec![left, right]),
                };
            }
        }

        Some(left)
    }

    /// 解析 AND 表达式
    fn parse_and_expression(&mut self) -> Option<QueryNode> {
        let mut left = self.parse_unary()?;

        loop {
            // 显式 AND 或隐式 AND（相邻词项）
            let is_and = matches!(self.peek(), Some(Token::And));
            let is_implicit_and = matches!(
                self.peek(),
                Some(Token::Word(_) | Token::Phrase(_) | Token::Field(_) | Token::Not | Token::LParen)
            );

            if is_and {
                self.advance(); // consume AND
            }

            if is_and || is_implicit_and {
                if let Some(right) = self.parse_unary() {
                    left = match left {
                        QueryNode::And(mut nodes) => {
                            nodes.push(right);
                            QueryNode::And(nodes)
                        }
                        _ => QueryNode::And(vec![left, right]),
                    };
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        Some(left)
    }

    /// 解析一元表达式 (NOT)
    fn parse_unary(&mut self) -> Option<QueryNode> {
        if matches!(self.peek(), Some(Token::Not)) {
            self.advance(); // consume NOT
            let inner = self.parse_primary()?;
            return Some(QueryNode::Not(Box::new(inner)));
        }
        self.parse_primary()
    }

    /// 解析基本表达式
    fn parse_primary(&mut self) -> Option<QueryNode> {
        match self.peek()?.clone() {
            Token::Word(word) => {
                self.advance();
                // 检查是否包含通配符
                if word.contains('*') || word.contains('?') {
                    Some(QueryNode::Wildcard(word))
                } else {
                    Some(QueryNode::Term(word))
                }
            }
            Token::Phrase(phrase) => {
                self.advance();
                Some(QueryNode::Phrase(phrase))
            }
            Token::Field(field) => {
                self.advance();
                // 检查操作符
                let operator = if matches!(self.peek(), Some(Token::Operator(_))) {
                    if let Some(Token::Operator(op)) = self.advance() {
                        op
                    } else {
                        FieldOperator::Eq
                    }
                } else {
                    FieldOperator::Eq
                };

                // 获取值
                let value = match self.peek() {
                    Some(Token::Word(w)) => {
                        let w = w.clone();
                        self.advance();
                        Box::new(QueryNode::Term(w))
                    }
                    Some(Token::Phrase(p)) => {
                        let p = p.clone();
                        self.advance();
                        Box::new(QueryNode::Phrase(p))
                    }
                    _ => return None,
                };

                Some(QueryNode::Field { field, value, operator })
            }
            Token::LParen => {
                self.advance(); // consume (
                let expr = self.parse_expression();
                if matches!(self.peek(), Some(Token::RParen)) {
                    self.advance(); // consume )
                }
                expr
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_term() {
        let result = QueryParser::parse("canon");
        assert!(result.is_valid);
        assert_eq!(result.fts_query, Some("canon*".to_string()));
    }

    #[test]
    fn test_phrase() {
        let result = QueryParser::parse("\"北京天安门\"");
        assert!(result.is_valid);
        assert_eq!(result.fts_query, Some("\"北京天安门\"".to_string()));
    }

    #[test]
    fn test_and_expression() {
        let result = QueryParser::parse("canon AND 风景");
        assert!(result.is_valid);
        assert!(result.fts_query.as_ref().unwrap().contains("AND"));
    }

    #[test]
    fn test_or_expression() {
        let result = QueryParser::parse("canon OR nikon");
        assert!(result.is_valid);
        assert!(result.fts_query.as_ref().unwrap().contains("OR"));
    }

    #[test]
    fn test_not_expression() {
        let result = QueryParser::parse("NOT 人像");
        assert!(result.is_valid);
        assert!(result.fts_query.as_ref().unwrap().contains("NOT"));
    }

    #[test]
    fn test_field_search() {
        let result = QueryParser::parse("camera:Canon");
        assert!(result.is_valid);
        assert_eq!(result.field_filters.len(), 1);
        assert_eq!(result.field_filters[0].field, "camera");
        assert_eq!(result.field_filters[0].value, "Canon");
    }

    #[test]
    fn test_tag_search() {
        let result = QueryParser::parse("tag:风景");
        assert!(result.is_valid);
        assert_eq!(result.tag_names, vec!["风景"]);
    }

    #[test]
    fn test_numeric_range() {
        let result = QueryParser::parse("iso:>800");
        assert!(result.is_valid);
        assert_eq!(result.field_filters.len(), 1);
        assert_eq!(result.field_filters[0].field, "iso");
        assert_eq!(result.field_filters[0].value, "800");
        assert_eq!(result.field_filters[0].operator, FieldOperator::Gt);
    }

    #[test]
    fn test_complex_query() {
        let result = QueryParser::parse("camera:Canon AND (风景 OR 人像) NOT 夜景");
        assert!(result.is_valid);
        assert_eq!(result.field_filters.len(), 1);
    }

    #[test]
    fn test_implicit_and() {
        let result = QueryParser::parse("canon 风景");
        assert!(result.is_valid);
        // 隐式 AND
        assert!(result.fts_query.as_ref().unwrap().contains("AND"));
    }

    #[test]
    fn test_empty_query() {
        let result = QueryParser::parse("");
        assert!(!result.is_valid);
        assert!(result.fts_query.is_none());
    }
}
