# MMDCARE — Your Safe Space to Talk

> 🌱 This is my first full-stack project — built to learn how a frontend, backend, database, and AI API all fit together. Feedback, suggestions, and issue reports are very welcome!

MMDCARE is a full-stack AI companion and mental-wellness chat application. It gives you a themed, responsive frontend backed by a real database and a real AI model, so you can start talking — or start building on top of it — right away.

This project uses:

- **Express.js**: backend framework
- **Node.js**: runtime environment
- **MySQL**: database (via `mysql2`)
- **Nginx**: reverse proxy and static file serving
- **Google Gemini API**: AI chat responses

Other tools and technologies used:

- **Tailwind CSS**: layout and styles
- **Lucide**: icons
- **GSAP**: animations
- **Docker Compose**: container orchestration
- **dotenv**: environment configuration

## Prerequisites

- Install [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- From the project root, create a `.env` file:

  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  ```

## Run

### Docker (recommended)

```bash
docker compose up --build
```

This starts three containers — MySQL, the Express backend, and Nginx — and creates the database tables automatically on first run.

Go to [localhost](http://localhost).

Stop everything with:

```bash
docker compose down
```

Add `-v` to also remove the MySQL data volume.

### Manual mode

1. Install and start MySQL locally, and create a database matching your `.env`/`docker-compose.yml` settings.
2. Install dependencies: `npm install`
3. Set the required environment variables (`GEMINI_API_KEY`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) either in a `.env` file or your shell.
4. Run the app: `npm start`
5. The backend listens on `localhost:3000`. Open `index.html` through a static server (or point Nginx at it) for the frontend.

## Environment Variables

| Variable       | Description                    | Default (Docker Compose) |
|----------------|----------------------------------|-----------------------------|
| `GEMINI_API_KEY` | Google Gemini API key           | *(required)*                |
| `DB_HOST`        | MySQL host                     | `mysql_db`                  |
| `DB_USER`        | MySQL user                     | `mmduser`                   |
| `DB_PASSWORD`    | MySQL password                 | `mmdpassword`                |
| `DB_NAME`        | MySQL database name            | `mmdcare_db`                 |
| `PORT`           | Backend listen port            | `3000`                       |

## API Endpoints

| Method | Endpoint             | Description                                |
|--------|------------------------|-----------------------------------------------|
| GET    | `/api/health`         | Health check                                  |
| POST   | `/api/users/login`    | Sign in / register a user (upsert by email)   |
| GET    | `/api/chats/:email`   | Fetch a user's saved chat history             |
| POST   | `/api/chat`             | Send a message, get an AI reply from Gemini    |

## Notes & Known Limitations

- Chat history is only saved for signed-in (non-anonymous) users.
- The safety layer uses keyword matching to flag crisis language and redirect medication-related queries — it's a basic safeguard, not a clinical one.
- Google periodically retires older Gemini model versions. If `/api/chat` starts returning a "model no longer available" error, update the model name used in `server.js`.
- Default MySQL credentials in `docker-compose.yml` are for local development only — change them before any real deployment.

## Issues

Please open an issue if:
- you have a suggestion to improve this project
- you noticed a problem or error

## License

This project is licensed under the [MIT License](LICENSE).


## Author

Akash Minj

