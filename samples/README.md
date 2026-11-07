# AgentScope Java 2.0.4 配套示例

对齐版本：**AgentScope Java 2.0.4** + **JDK 17**。

## 运行

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot"
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"

cd samples
mvn test
$env:DEEPSEEK_API_KEY="..."
mvn -q exec:java "-Dexec.mainClass=com.example.samples.Samples"
```

## 内容

- `Samples`：`OpenAIChatModel` + `ReActAgent` + `Toolkit`，走 DeepSeek OpenAI 兼容端点。
- `WeatherTools`：`@Tool` / `@ToolParam`。
- `SamplesTest`：离线验证工具、`RuntimeContext` 与 `Toolkit`，不访问网络。

## 说明

- `mvn test` 不需要 API Key。
- `Samples` 需要 `DEEPSEEK_API_KEY`。
- DeepSeek 使用 `DeepSeekFormatter`；`baseUrl` 是 `https://api.deepseek.com`。
- 响应式调用用 `.block()` 收口，真实服务里应保持 `Mono` / `Flux`。
