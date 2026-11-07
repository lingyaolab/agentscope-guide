package com.example.samples;

import io.agentscope.core.ReActAgent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.Model;
import io.agentscope.core.tool.Toolkit;
import io.agentscope.extensions.model.openai.OpenAIChatModel;
import io.agentscope.extensions.model.openai.compat.deepseek.DeepSeekFormatter;

import java.util.List;

public final class Samples {

    private Samples() {
    }

    public static Model model() {
        String apiKey = System.getenv("DEEPSEEK_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Set DEEPSEEK_API_KEY first.");
        }
        return OpenAIChatModel.builder()
                .apiKey(apiKey)
                .baseUrl("https://api.deepseek.com")
                .modelName(System.getenv().getOrDefault("DEEPSEEK_MODEL", "deepseek-chat"))
                .stream(false)
                .formatter(new DeepSeekFormatter())
                .build();
    }

    public static void main(String[] args) {
        Toolkit toolkit = new Toolkit();
        toolkit.registerTool(new WeatherTools());

        RuntimeContext ctx = RuntimeContext.builder()
                .userId("alice")
                .sessionId("sample-1")
                .build();

        try (ReActAgent agent = ReActAgent.builder()
                .name("WeatherAgent")
                .sysPrompt("你是一个简洁的天气助手。需要天气时调用工具，回答不超过两句话。")
                .model(model())
                .toolkit(toolkit)
                .maxIters(4)
                .build()) {
            Msg reply = agent.call(List.of(new UserMessage("北京天气如何？")), ctx).block();
            System.out.println(reply.getTextContent());
        }
    }
}
