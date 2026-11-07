package com.example.samples;

import io.agentscope.core.tool.Tool;
import io.agentscope.core.tool.ToolParam;

public class WeatherTools {

    @Tool(description = "查询指定城市的天气，只读")
    public String weather(
            @ToolParam(name = "city", description = "城市名，例如 Beijing") String city) {
        return city + ": 18C, sunny";
    }
}
