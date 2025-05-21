# Team Polls - Live Polling System

This is a proof-of-concept for a live "Team Polls" product, similar to Slido-lite, demonstrating poll creation, vote casting, and real-time result streaming.

## Features

* **REST API**: For poll creation, vote casting, and retrieving poll data.
* **WebSocket API**: For real-time updates of poll results.
* **Anonymous JWT Auth**: Short-lived tokens for vote casting.
* **Rate Limiting**: 5 votes/sec per user.
* **Persistence**: PostgreSQL database via Prisma ORM.
* **Caching/Pub/Sub**: Redis for WebSocket fan-out and rate limiting.
* **Docker-first**: Easy setup with `docker compose`.
* **TypeScript**: Type-safe backend development.
* **Unit/Integration Tests**: Basic test coverage.

## Architecture