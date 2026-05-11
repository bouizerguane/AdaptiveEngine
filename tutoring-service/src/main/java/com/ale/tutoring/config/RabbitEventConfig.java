package com.ale.tutoring.config;

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
    public Queue labSubmittedQueue(@Value("${app.events.lab-submitted-queue:tutoring.lab-submitted}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Queue quizCompletedQueue(@Value("${app.events.quiz-completed-queue:tutoring.quiz-completed}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding labSubmittedBinding(Queue labSubmittedQueue, TopicExchange adaptiveEventsExchange) {
        return BindingBuilder.bind(labSubmittedQueue).to(adaptiveEventsExchange).with("lab.submitted");
    }

    @Bean
    public Binding quizCompletedBinding(Queue quizCompletedQueue, TopicExchange adaptiveEventsExchange) {
        return BindingBuilder.bind(quizCompletedQueue).to(adaptiveEventsExchange).with("quiz.completed");
    }
}
