interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

/**
 * 将用户输入和搜索选项转换为 Zoekt 查询语法
 */
export function buildZoektQuery(input: string, options: SearchOptions): string {
  if (!input) return '';

  let query = input;

  // 1. 处理正则表达式
  if (options.regex) {
    // 如果是正则，且没有被 '/' 包裹，我们手动包裹它以确保它是 regex 模式
    // Zoekt 的 `regex:` 字段或者直接 `/pattern/` 都可以
    // 这里为了简单，如果用户输入了 regex，我们假设内容本身就是 pattern
    // 如果用户没有用 / 包裹，我们帮他包裹，或者使用 content: 字段
    // 更稳妥的方式是使用 `regex:` 前缀，但 Zoekt 的文档显示 content:/regex/ 也是支持的
    // 让我们用最通用的方式：如果选择了正则，就用 `regex:pattern`
    // 但要注意，如果用户已经输入了 field（比如 file:main.go），我们不应该破坏它。
    // 这是一个简化的实现，假设用户在普通模式下主要搜索 content。
    
    // 如果输入本身不包含任何 field 前缀，我们才把它当作纯 content/regex 处理
    if (!/:/.test(query)) {
        query = `regex:${query}`;
    }
  } else {
    // 如果不是正则，我们需要转义特殊字符，确保它们被当作普通字符串处理
    // Zoekt 中使用引号来表示字面量字符串
    // 如果输入不包含 field 前缀
    if (!/:/.test(query)) {
       // 简单的转义双引号
       query = `"${query.replace(/"/g, '\\"')}"`;
    }
  }

  // 2. 处理全词匹配
  // 全词匹配通常通过正则的单词边界 \b 来实现
  if (options.wholeWord) {
    // 如果已经是 regex，我们在两头加上 \b
    if (query.startsWith('regex:')) {
        query = `regex:\\b${query.substring(6)}\\b`;
    } else if (query.startsWith('"') && query.endsWith('"')) {
        // 如果是字面量，我们得把它转成正则才能用 \b，或者 Zoekt 有其他方式？
        // Zoekt 文档没明确说字面量的全词匹配。通常转换为 regex 是最安全的方法。
        // 去掉引号，转义正则特殊字符，然后加 \b
        const rawContent = query.substring(1, query.length - 1);
        const escaped = rawContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query = `regex:\\b${escaped}\\b`;
    } else if (!/:/.test(input)) { // 兜底，如果是裸文本
         const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         query = `regex:\\b${escaped}\\b`;
    }
  }

  // 3. 处理大小写
  // Zoekt 使用 `case:yes` 或 `case:no`
  if (options.caseSensitive) {
    query = `case:yes ${query}`;
  } else {
    // 默认可能是 auto，如果我们想强制不区分大小写，可以加 case:no
    // 这里我们显式加上 case:no 以匹配用户的非选中状态
    // 但要注意，如果用户输入了全大写，auto 可能会自动变为 case-sensitive。
    // 为了完全受控，建议显式加上。
     query = `case:no ${query}`;
  }

  return query.trim();
}