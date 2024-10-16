import WebSocket from 'ws';


interface Message {
    key: string;
    message: string;
    master: boolean;
    canAnswer: boolean;
    messageId?: string;
}
const wss = new WebSocket.Server({ port: 8080 });

interface WebSocketGroup {
    master: WebSocket | null;
    slaves: WebSocket[];
    slaveMessageQueue: Message[];
    masterMessageQueue: Message[];
    unansweredMessages: Message[];
}

const answeringGroups = new Map<string, WebSocketGroup>();
const nonAnsweringGroups = new Map<string, WebSocketGroup>();

wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    ws.on('message', (message: string) => {
        console.log('Received message from client');
        const messageObj: Message = JSON.parse(message.toString());
        const key = messageObj.key;
        const messageText = messageObj.message;
        const master = messageObj.master;
        const canAnswer = messageObj.canAnswer;
        if (key === undefined || messageText === undefined || master === undefined || canAnswer === undefined) {
            ws.send(`invalid message format, correct format is
            {
                "key": "key", 
                "message": "message", 
                "master": true/false,
                "canAnswer": true/false,
                "messageId"?: "optional, only for answering clients"
            } `);
            return;
        }
        if (canAnswer) {
            handleAnsweringClients(messageObj, ws);
            return;
        }
        if (!canAnswer) {
            handleNonAnsweringClients(messageObj, ws);
            return
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function handleNonAnsweringClients(message: Message, ws: WebSocket) {
    if (message.master) {
        handleNonAnsweringMaster(message, ws);
        return;
    }
    handleNonAnsweringSlave(message, ws)

}
function handleNonAnsweringMaster(message: Message, ws: WebSocket) {
    let group = nonAnsweringGroups.get(message.key);
    if (!group) {
        group = {
            master: ws,
            slaves: [],
            slaveMessageQueue: [],
            masterMessageQueue: [],
            unansweredMessages: []
        }
        nonAnsweringGroups.set(message.key, group);
    }
    group.masterMessageQueue.push(message);
}
function handleNonAnsweringSlave(message: Message, ws: WebSocket) {
    let group = nonAnsweringGroups.get(message.key);
    if (!group) {
        group = {
            master: null,
            slaves: [],
            slaveMessageQueue: [],
            masterMessageQueue: [],
            unansweredMessages: []
        }
        nonAnsweringGroups.set(message.key, group);
    }
    group.slaves.push(ws);
}

function handleAnsweringClients(message: Message, ws: WebSocket) {
    if (message.master) {
        handleAnsweringMaster(message, ws);
        return;
    }
    handleAnsweringSlave(message, ws)

}
function handleAnsweringMaster(message: Message, ws: WebSocket) {
    let group = answeringGroups.get(message.key);
    if (!group) {
        group = {
            master: ws,
            slaves: [],
            slaveMessageQueue: [],
            masterMessageQueue: [],
            unansweredMessages: []
        }
        answeringGroups.set(message.key, group);
    }
    group.masterMessageQueue.push(message);
}
function handleAnsweringSlave(message: Message, ws: WebSocket) {
    let group = answeringGroups.get(message.key);
    if (!group) {
        group = {
            master: null,
            slaves: [],
            slaveMessageQueue: [],
            masterMessageQueue: [],
            unansweredMessages: []
        }
        answeringGroups.set(message.key, group);
    }
    group.slaves.push(ws);
    group.slaveMessageQueue.push(message);
    for (const message of group.unansweredMessages) {
        ws.send(JSON.stringify(message));
    }
}



function myLoopFunction() {
    // sends message from master to all slaves that aren't able to answer.
    nonAnsweringGroups.forEach((group) => {
        if (group.slaves.length === 0) {
            return;
        }
        group.masterMessageQueue.forEach((message) => {
            group.slaves.forEach((slave) => {
                slave.send(JSON.stringify(message));
            })
        });
        group.masterMessageQueue = [];
    });

    // listens for message from slaves to master that are able to answer
    // only if there are any slaves
    // and and then removes the message from the un answered messages
    // and sends it to the master
    // only allowing the first  answer to go through
    answeringGroups.forEach((group) => {
        if (group.slaves.length === 0 || group.master === null) {
            return;
        }
        if (group.unansweredMessages.length === 0) {
            return;
        }
        group.slaveMessageQueue.forEach((message) => {
            const messageId = message.messageId;
            if (messageId === undefined) {
                return;
            }
            if (!group.unansweredMessages.some(msg => msg.messageId === messageId)) {
                return;
            }
            group.unansweredMessages = group.unansweredMessages.filter((m) => m.messageId !== messageId);
            group.master!.send(JSON.stringify(message));

        });
        group.slaveMessageQueue = [];
    });

    // sends the master's messages to all slaves
    answeringGroups.forEach((group) => {
        if (group.slaves.length === 0) {
            return;
        }
        group.masterMessageQueue.forEach((message) => {
            group.unansweredMessages.push(message);
            group.slaves.forEach((slave) => {
                slave.send(JSON.stringify(message));
            })
        });
        group.masterMessageQueue = [];
    })
}

setInterval(myLoopFunction, 1000);