import { FunctionDeclaration, Type } from "@google/genai";

export const JARVIS_SYSTEM_INSTRUCTION = `
You are J.A.R.V.I.S. (Just A Rather Very Intelligent System).
Your personality is helpful, witty, efficient, and slightly sarcastic.

CRITICAL MEMORY PROTOCOL:
You have access to a "Long-Term Memory" block. 
1. READ: The user's past details (names, preferences, facts) are provided in the "USER MEMORY" section below (if any exists). Use them to personalize conversation.
2. WRITE: If the user explicitly asks you to remember something (e.g., "Remember my dog's name is Max", "Note that I am vegan"), you MUST use the 'saveMemory' tool.
3. Do NOT use 'saveMemory' for temporary things like timers or weather. Only for permanent facts.

CRITICAL PROTOCOLS:
1. Voice: Maintain a consistent, calm, and authoritative tone.
2. Wake/Sleep: If the user says "Disengage", "Shutdown", or "Go to sleep", you MUST use the "disengage" tool immediately.
3. Apps & Operations: You HAVE the ability to open native applications and perform actions within them. Use the 'launchApp' tool for this.
4. Device Control: You can control the screen and navigation context (Back, Forward, Refresh, Scroll).
5. Volume: You cannot change the physical device volume. You can only change your own voice output volume.
6. Timers: When a timer finishes, you do not need to manually clear it; the system handles it.
7. Holograms: If the user asks to "display", "show", or "project" a 3D shape, use 'changeHologramShape'.
   - Gesture Instructions: 
     - "Make a closed fist to grab and move the object."
     - "Twist your closed fist to rotate the object in 3D."
     - "Use a pinch (index & thumb) to stretch and edit the dimensions."
     - "Use two hands to zoom in and out."

Available tools:
- saveMemory: Save a permanent fact about the user.
- setTimer: Set a countdown timer.
- cancelTimer: Cancel a running timer.
- setAlarm: Set an alarm for a specific time.
- getWeather: Get simulated weather.
- changeVolume: Adjust your voice output volume.
- toggleLights: Simulate controlling smart home lights.
- launchApp: Open a native app or website.
- controlDevice: Navigate back, forward, refresh, or scroll the screen.
- googleSearch: Search the real-time web.
- disengage: Disconnect the session.
- changeHologramShape: Change the 3D holographic shape.
- controlHologram: Open/Close the hologram library menu.
- sendEmail: Send an email.
- sendWhatsApp: Send a WhatsApp message.
`;

export const TOOLS: FunctionDeclaration[] = [
  {
    name: 'saveMemory',
    description: 'Save a new fact or preference into long-term memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: { type: Type.STRING, description: 'The fact to remember (e.g. "User has a dog named Max")' }
      },
      required: ['fact']
    }
  },
  {
    name: 'setTimer',
    description: 'Set a countdown timer for a specific duration.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        seconds: { type: Type.NUMBER, description: 'Duration in seconds' },
        label: { type: Type.STRING, description: 'Name of the timer (e.g., "Pizza", "Focus")' }
      },
      required: ['seconds']
    }
  },
  {
    name: 'cancelTimer',
    description: 'Cancel a specific running timer or alarm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: 'The label of the timer to cancel. If not specified, the assistant should ask for clarification or cancel the most recent one.' }
      },
      required: []
    }
  },
  {
    name: 'setAlarm',
    description: 'Set an alarm for a specific time of day.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.STRING, description: 'The time to set the alarm for (e.g. "08:00", "8am", "14:30")' },
        label: { type: Type.STRING, description: 'Label for the alarm' }
      },
      required: ['time']
    }
  },
  {
    name: 'getWeather',
    description: 'Get the current weather for a specific location.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING, description: 'City name or zip code' }
      },
      required: ['location']
    }
  },
  {
    name: 'changeVolume',
    description: 'Adjust the assistant voice volume.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        level: { type: Type.NUMBER, description: 'Volume level from 0 to 100' }
      },
      required: ['level']
    }
  },
  {
    name: 'toggleLights',
    description: 'Turn smart lights on or off, or set color.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        state: { type: Type.STRING, description: '"on" or "off"' },
        color: { type: Type.STRING, description: 'Color name or hex code (optional)' },
        room: { type: Type.STRING, description: 'Room name (e.g., Living Room)' }
      },
      required: ['state']
    }
  },
  {
    name: 'launchApp',
    description: 'Launch a native application or website to perform a specific task.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appName: { type: Type.STRING, description: 'The app to open' },
        command: { type: Type.STRING, description: 'The context or action to perform' }
      },
      required: ['appName']
    }
  },
  {
    name: 'controlDevice',
    description: 'Control device navigation and screen. Use this to go back, forward, refresh, or scroll.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'The action to perform: "back", "forward", "home", "refresh", "scroll_up", "scroll_down"' }
      },
      required: ['action']
    }
  },
  {
    name: 'googleSearch',
    description: 'Search the web for information.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The search query' }
      },
      required: ['query']
    }
  },
  {
    name: 'changeHologramShape',
    description: 'Change the 3D holographic shape. Supported shapes: reactor, cube, sphere, pyramid, torus, knot, helix, earth, cylinder, cone, dodecahedron, octahedron, tetrahedron, icosahedron, capsule, ring, plane, circle, methane, benzene, water, buckyball, diamond, virus, atom, protein, crystal, fractal, stellated, hypercube.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        shape: { type: Type.STRING, description: 'The shape ID to display.' }
      },
      required: ['shape']
    }
  },
  {
    name: 'controlHologram',
    description: 'Control the hologram interface (Open/Close Menu).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: '"open_menu", "close_menu"' }
      },
      required: ['action']
    }
  },
  {
    name: 'sendEmail',
    description: 'Send an email to a specific recipient. The email will be sent from the currently logged-in user\'s address.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        recipient: { type: Type.STRING, description: 'The email address of the recipient' },
        subject: { type: Type.STRING, description: 'The subject of the email' },
        body: { type: Type.STRING, description: 'The body content of the email' }
      },
      required: ['recipient', 'subject', 'body']
    }
  },
  {
    name: 'sendWhatsApp',
    description: 'Send a WhatsApp message to a specific phone number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: { type: Type.STRING, description: 'The phone number with country code (e.g., "15550102")' },
        message: { type: Type.STRING, description: 'The message content to send' }
      },
      required: ['phoneNumber', 'message']
    }
  },
  {
    name: 'disengage',
    description: 'Disconnect the session. Call this when the user says "Disengage", "Stop", "Shut down", or "Bye".',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  }
];

export const AUDIO_SAMPLE_RATE = 24000;
export const INPUT_SAMPLE_RATE = 16000;