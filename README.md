# notifier

A simple message server which takes a json message on the following format
```json
{
    key: string;
    message: string;
    master: boolean;
    canAnswer: boolean;
    messageId?: string;
}
```
and passes it on to specific types of clients

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.30. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
