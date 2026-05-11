package com.ale.tracking.config;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitEventConfig {

    @Bean
    public TopicExchange adaptiveEventsExchange(@Value("${app.events.exchange:adaptive.events}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }
}
