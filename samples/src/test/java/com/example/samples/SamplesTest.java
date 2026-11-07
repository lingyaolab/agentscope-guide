package com.example.samples;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.tool.Toolkit;
import org.junit.jupiter.api.Test;

class SamplesTest {

    @Test
    void weatherToolIsPlainJava() {
        assertEquals("Beijing: 18C, sunny", new WeatherTools().weather("Beijing"));
    }

    @Test
    void runtimeContextCarriesIdentity() {
        RuntimeContext ctx = RuntimeContext.builder()
                .userId("alice")
                .sessionId("s1")
                .build();
        assertEquals("alice", ctx.getUserId());
        assertEquals("s1", ctx.getSessionId());
    }

    @Test
    void toolkitRegistersTool() {
        Toolkit toolkit = new Toolkit();
        toolkit.registerTool(new WeatherTools());
        assertEquals(true, toolkit.getToolNames().contains("weather"));
    }
}
