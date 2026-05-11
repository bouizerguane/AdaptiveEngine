package com.ale.adaptive.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
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

    @Bean
    public Queue adaptiveQuizCompletedQueue(
            @Value("${app.events.quiz-completed-queue:adaptive.quiz-completed}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Queue adaptiveLabSubmittedQueue(
            @Value("${app.events.lab-submitted-queue:adaptive.lab-submitted}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding adaptiveQuizCompletedBinding(Queue adaptiveQuizCompletedQueue, TopicExchange adaptiveEventsExchange) {
        return BindingBuilder.bind(adaptiveQuizCompletedQueue).to(adaptiveEventsExchange).with("quiz.completed");
    }

    @Bean
    public Binding adaptiveLabSubmittedBinding(Queue adaptiveLabSubmittedQueue, TopicExchange adaptiveEventsExchange) {
        return BindingBuilder.bind(adaptiveLabSubmittedQueue).to(adaptiveEventsExchange).with("lab.submitted");
    }
}
