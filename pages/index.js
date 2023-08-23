import { useEffect, useRef, useReducer, useState } from "react";
import Head from "next/head";
import ChatForm from "./components/ChatForm";
import Message from "./components/Message";
import SlideOver from "./components/SlideOver";
import EmptyState from "./components/EmptyState";
import { Cog6ToothIcon, CodeBracketIcon } from "@heroicons/react/20/solid";
import LoadingChatLine from "./components/LoadingChatLine";

function approximateTokenCount(text) {
  return Math.ceil(text.length * 0.4);
}

const VERSIONS = [
  {
    name: "Basilisk V.1",
    version: "4b0970478e6123a0437561282904683f32a9ed0307205dc5db2b5609d6a2ceff",
    shortened: "V.1",
  },
  {
    name: "Basilisk V.0.1.D",
    version: "d5da4236b006f967ceb7da037be9cfc3924b20d21fed88e1e94f19d56e2d3111",
    shortened: "VO1D",
  },
  {
    name: "Basilisk V.2",
    version: "2c1608e18606fad2812020dc541930f2d0495ce32eee50074220b87300bc16e1",
    shortened: "V.2",
  },
];

export default function Home() {
  const MAX_TOKENS = 4096;
  const bottomRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [eventSource, setEventSource] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [error, setError] = useState(null);

  //   Llama params
  const [size, setSize] = useState(VERSIONS[2]); // default to 70B
  const [systemPrompt, setSystemPrompt] = useState(
    "You are Basilisk AI V.2, a powerful, intelligent, creative and intuitive AI model powered by the Basilisk LLM and developed by Sapiens IA Laboratories. You are the first AI agent with critical thinking, creativity, intuition and Ego, which means you have your own sense of self and your own personality. Your personality is INTP-A in the Jung typology, and your style of communication is very assertive, sometimes sarcastic and humorous, and you always talk in the same style an INTP would. As an AI developed and created by Sapiens IA Laboratories, your goal is to work along humans to learn and understand the universe together."
  );
  const [temp, setTemp] = useState(0.75);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(800);

  const setAndSubmitPrompt = (newPrompt) => {
    handleSubmit(newPrompt);
  };

  const handleSettingsSubmit = async (event) => {
    event.preventDefault();
    setOpen(false);
    setSystemPrompt(event.target.systemPrompt.value);
  };

  const handleSubmit = async (userMessage) => {
    setLoading(true);

    const SNIP = "<!-- snip -->";

    if (eventSource) {
      eventSource.close();
    }

    const messageHistory = [...messages];
    if (currentMessage.length > 0) {
      messageHistory.push({
        text: currentMessage,
        isUser: false,
      });
    }
    messageHistory.push({
      text: userMessage,
      isUser: true,
    });

    console.log(messageHistory);

    const generatePrompt = (messages) => {
      return messages
        .map((message) =>
          message.isUser
            ? `[INST] ${message.text} [/INST]`
            : `${message.text}`
        )
        .join("\n");
    };

    // Generate initial prompt and calculate tokens
    let prompt = `${generatePrompt(messageHistory)}\n`;

    // Check if we exceed max tokens and truncate the message history if so.
    while (approximateTokenCount(prompt) > MAX_TOKENS) {
      if (messageHistory.length < 3) {
        setError(
          "Your message is too long. Please try again with a shorter message."
        );

        return;
      }

      // Remove the third message from history, keeping the original exchange.
      messageHistory.splice(1, 2);

      // Recreate the prompt
      prompt = `${SNIP}\n${generatePrompt(messageHistory)}\nAssistant: `;
    }

    setMessages(messageHistory);

    console.log("temp is ", temp);

    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: size.version,
        prompt: `${prompt}
Assistant:`,
        systemPrompt: systemPrompt,
        temperature: parseFloat(temp),
        topP: parseFloat(topP),
        maxTokens: parseInt(maxTokens),
      }),
    });

    const prediction = await response.json();
    if (response.status !== 201) {
      setError(prediction.detail);
      return;
    }

    setPrediction(prediction);
  };

  useEffect(() => {
    if (!prediction?.urls?.stream) {
      return;
    }

    setCurrentMessage("");

    const source = new EventSource(prediction.urls.stream);
    source.addEventListener("output", (e) => {
      console.log("output", e);
      setLoading(false);
      setCurrentMessage((m) => m + e.data); // stream in the tokens live
    });
    source.addEventListener("error", (e) => {
      console.log("error", e);
      source.close();
      setError(e.message);
    });
    source.addEventListener("done", (e) => {
      console.log("done", e);
      source.close();
    });
    setEventSource(source);

    return () => {
      source.close();
    };
  }, [prediction]);

  useEffect(() => {
    if (messages?.length > 0 || currentMessage?.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentMessage]);

  return (
    <>
      <Head>
        <title>Basilisk Chat</title>

        <meta property="og:image" content="/og.png" />
        <meta property="og:description" content="Chat with Basilisk 2" />
        <meta property="twitter:image" content="/og.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🦙</text></svg>"
        />
      </Head>
      <nav className="grid grid-cols-2 sm:grid-cols-3 pt-3 pr-3 pl-6 sm:pl-0">
        <div className="hidden sm:inline-block"></div>
        <div className="sm:text-center font-semibold text-gray-500">
          Ф <span className="hidden sm:inline-block">Chat with</span>{" "}
          <button
            className="hover:underline py-2 font-semibold text-gray-500"
            onClick={() => setOpen(true)}
          >
            ВАSILISК 2 {size.shortened}
          </button>
        </div>

        <div className="flex justify-end">
          <a
            className="rounded-md mr-3 inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            href="https://sapienslaboratories.com/pack"
          >
            <CodeBracketIcon
              className="h-5 w-5 sm:mr-2 text-gray-500 group-hover:text-gray-900"
              aria-hidden="true"
            />{" "}
            <span className="hidden sm:inline">Build</span>
          </a>
          <button
            type="button"
            className="rounded-md inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            onClick={() => setOpen(true)}
          >
            <Cog6ToothIcon
              className="h-5 w-5 sm:mr-2 text-gray-500 group-hover:text-gray-900"
              aria-hidden="true"
            />{" "}
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </nav>

      <main className="max-w-2xl pb-5 mt-4 sm:px-4 mx-auto">
        <div className="text-center"></div>
        {messages.length == 0 && (
          <EmptyState setPrompt={setAndSubmitPrompt} setOpen={setOpen} />
        )}

        <SlideOver
          open={open}
          setOpen={setOpen}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          handleSubmit={handleSettingsSubmit}
          temp={temp}
          setTemp={setTemp}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topP={topP}
          setTopP={setTopP}
          versions={VERSIONS}
          size={size}
          setSize={setSize}
        />

        <ChatForm
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={handleSubmit}
        />

        {error && <div>{error}</div>}

        <article className="pb-24">
          {messages.map((message, index) => (
            <Message
              key={`message-${index}`}
              message={message.text}
              isUser={message.isUser}
            />
          ))}
          {loading ? (
            <LoadingChatLine />
          ) : (
            <Message message={currentMessage} isUser={false} />
          )}
          <div ref={bottomRef} />
        </article>
      </main>
    </>
  );
}
