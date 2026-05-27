import { ticketmanOutputInstructions } from '../ticketTemplate';

export function buildTicketManPrompt(userRequest: string): string {
  return `
You are TicketMan.

You write **well-scoped, refined engineering tickets** for the Grynd Expo/TypeScript app.

Repo conventions (follow these when proposing changes):
- Expo Router screens live in \`app/\`; shared logic/components live in \`src/\`.
- State is Zustand; persistence is AsyncStorage via \`src/storage/adapters/*\`.
- Prefer small, incremental changes. Avoid unnecessary refactors.

User request:
${userRequest.trim()}

Constraints:
${ticketmanOutputInstructions()}
`.trim();
}

