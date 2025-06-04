import { Detail, ActionPanel, Action, showToast, Toast, getPreferenceValues, Clipboard } from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import axios from "axios";

// Chunk structure from RunLLM API
interface Chunk {
  chunk_type: string;
  chat_id: number;
  session_id: number;
  content: string;
  model_id: number;
  classified_case: string | null;
}

// Chunk types enum
enum ChunkType {
  Retrieval = "retrieval",
  Classification = "classification",
  GenerationStarts = "generation_starts",
  GenerationInProgress = "generation_in_progress",
}

interface Preferences {
  apiKey: string;
  pipelineId: string;
  streamingSpeed: string;
}

interface CommandProps {
  arguments: {
    query: string;
  };
}

// Main component that handles the command arguments and detail view
export default function Command(props: CommandProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [response, setResponse] = useState<string>("");
  // Using errorMessage instead of error to avoid the lint error
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const requestMadeRef = useRef<boolean>(false);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTextRef = useRef<string>("");
  // Complete response accumulated from all chunks
  const completeResponseRef = useRef<string>("");
  
  const preferences = getPreferenceValues<Preferences>();
  
  // Get the query from command arguments
  const query = props.arguments.query;
  
  // Ask the question when the component mounts, but only once
  useEffect(() => {
    if (query.trim() && !requestMadeRef.current) {
      requestMadeRef.current = true;
      askQuestion(query.trim());
    }
    
    // Cleanup function to clear interval when component unmounts
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };
  }, [query]);

  // Function to handle text streaming animation
  const startStreamingAnimation = () => {
    // Clear any existing interval
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }
    
    // Get streaming speed from preferences (ms per character)
    const speedPreference = preferences.streamingSpeed || "30";
    const streamingSpeed = parseInt(speedPreference, 10);
    
    console.log("Starting streaming animation");
    
    streamingIntervalRef.current = setInterval(() => {
      // If there's pending text to display, show it character by character
      if (pendingTextRef.current.length > 0) {
        // Remove the next character from pending text
        pendingTextRef.current = pendingTextRef.current.substring(1);
        
        // Log every 50 characters for debugging
        if (pendingTextRef.current.length % 50 === 0) {
          console.log(`Animation progress: ${pendingTextRef.current.length} characters remaining`);
        }
        
        // Update the displayed text - always use the complete response as the source of truth
        // This ensures we're always showing the complete text minus what's still pending
        const displayedLength = completeResponseRef.current.length - pendingTextRef.current.length;
        const displayedText = completeResponseRef.current.substring(0, displayedLength);
        setResponse(displayedText);
      } 
      // If no more pending text, stop the animation
      else {
        console.log("Animation complete - all text displayed");
        // No more pending text, clear the interval
        if (streamingIntervalRef.current) {
          clearInterval(streamingIntervalRef.current);
          streamingIntervalRef.current = null;
        }
        
        // Make sure we display the complete response at the end
        setResponse(completeResponseRef.current);
      }
    }, streamingSpeed);
  };
  
  // Helper function to process SSE event data
  const processEventData = (event: string): void => {
    // Extract the data part (remove "data: " prefix)
    const dataMatch = event.match(/^data:\s*(.+)$/m);
    if (!dataMatch) return;
    
    const data = dataMatch[1];
    
    try {
      // Parse the JSON data
      const chunk = JSON.parse(data) as Chunk;
      
      // Log chunk information for debugging
      console.log(`Received chunk: type=${chunk.chunk_type}, length=${chunk.content?.length || 0}`);
      if (chunk.content) {
        console.log(`Chunk content preview: ${chunk.content.substring(0, 30)}...`);
        // Log full content for detailed debugging
        console.log(`Complete chunk content: "${chunk.content}"`);
      }
      
      // Store session ID for potential follow-up questions
      if (chunk.session_id && !sessionId) {
        setSessionId(chunk.session_id);
      }
      
      // Only process content from generation_in_progress chunks
      if (chunk.chunk_type === ChunkType.GenerationInProgress && chunk.content) {
        // Add the content to the complete response
        completeResponseRef.current += chunk.content;
        
        // Add to pending text for streaming animation
        pendingTextRef.current += chunk.content;
        
        // Start streaming animation if not already started
        if (!streamingIntervalRef.current) {
          startStreamingAnimation();
        }
        
        console.log(`Added chunk to response. Total length now: ${completeResponseRef.current.length}`);
      }
    } catch (e) {
      console.error("Error parsing chunk data:", e);
    }
  };
  
  const askQuestion = async (query: string) => {
    // Reset states
    setIsLoading(true);
    setResponse("");
    setErrorMessage(null);
    pendingTextRef.current = "";
    completeResponseRef.current = "";
    
    // Clear any existing streaming interval
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    
    // Validate inputs
    if (!preferences.apiKey) {
      setErrorMessage("Please set your RunLLM API key in the extension preferences.");
      setIsLoading(false);
      return;
    }

    if (!preferences.pipelineId) {
      setErrorMessage("Please set your RunLLM Pipeline ID in the extension preferences.");
      setIsLoading(false);
      return;
    }

    try {
      const pipelineIdAsNumber = parseInt(preferences.pipelineId, 10);
      const isPipelineIdNumeric = !isNaN(pipelineIdAsNumber);
      
      const pipelineIdForUrl = isPipelineIdNumeric ? pipelineIdAsNumber : preferences.pipelineId;
      const apiUrl = `https://api.runllm.com/api/pipeline/${pipelineIdForUrl}/chat`;
      
      const payload = {
        message: query,
        ...(sessionId ? { session_id: sessionId } : {})
      };
      
      await showToast({
        style: Toast.Style.Animated,
        title: "RunLLM thinking..."
      });
      
      try {
        // Set loading to false once we start receiving data
        // This allows the Detail component to start showing content
        setIsLoading(false);
        
        // Make a streaming request using fetch and process chunks as they arrive
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Create a fetch request that we can process as a stream
        const fetchResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': preferences.apiKey,
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify(payload),
          signal
        });
        
        if (!fetchResponse.ok) {
          throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
        }
        
        if (!fetchResponse.body) {
          throw new Error('Response body is null');
        }
        
        // Get a reader from the response body stream
        const reader = fetchResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        // Process the stream
        console.log("Starting to process stream");
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("Stream done - processing any remaining data");
            // Process any remaining data in the buffer
            if (buffer.trim()) {
              processEventData(buffer);
            }
            break;
          }
          
          // Decode the chunk and add it to our buffer
          const chunk = decoder.decode(value, { stream: true });
          console.log(`Received raw chunk data: ${chunk.length} bytes`);
          console.log(`Raw chunk content: "${chunk}"`);
          buffer += chunk;
          
          // Process complete events in the buffer
          const events = buffer.split('\n\n');
          console.log(`Split into ${events.length} events (last one may be incomplete)`);
          
          // Keep the last potentially incomplete event in the buffer
          buffer = events.pop() || '';
          
          // Process each complete event
          for (const event of events) {
            if (event.trim()) {
              processEventData(event);
            }
          }
        }
      } catch (e) {
        console.error('Error in stream processing:', e);
        throw e;
      }
      
        
      // Show a toast with the completion status
      await showToast({
        style: Toast.Style.Success,
        title: "Response processing complete",
      });
      // Fetch error handling is done in the try/catch above
      
      // Copy response to clipboard when done
      const finalResponse = completeResponseRef.current;
      if (finalResponse) {
        await Clipboard.copy(finalResponse);
        
        await showToast({
          style: Toast.Style.Success,
          title: "Response received",
          message: "Copied to clipboard",
        });
      } else {
        throw new Error("No response received from RunLLM");
      }
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        const errorConfig = error.config;
        
        // Log comprehensive error information
        console.error("=== API ERROR DETAILS ===");
        console.error(`Status Code: ${statusCode}`);
        console.error(`Error Data:`, errorData);
        console.error(`Request URL: ${errorConfig?.url}`);
        console.error(`Request Method: ${errorConfig?.method}`);
        console.error(`Request Headers:`, errorConfig?.headers);
        console.error(`Request Data:`, errorConfig?.data);
        console.error("=========================");
        
        let errorMessage = `Error ${statusCode}: `;
        
        if (statusCode === 422) {
          errorMessage += "The API couldn't process your request. Check your pipeline ID format.";
          
          // Show more detailed error information
          setErrorMessage(`422 Unprocessable Entity Error\n\nPipeline ID: ${preferences.pipelineId}\n\nPossible issues:\n1. Pipeline ID format is incorrect (should it be a number?)\n2. API endpoint URL format may be wrong\n3. Required parameters might be missing\n\nError details: ${JSON.stringify(errorData)}\n\nTry checking the Raycast console logs for more information.`);
        } else if (statusCode === 403) {
          errorMessage += "Authentication failed. Please check your API key.";
          setErrorMessage("Authentication failed. Please check your API key.");
        } else {
          errorMessage += error.message;
          setErrorMessage(error.message);
        }
        
        await showToast({
          style: Toast.Style.Failure,
          title: "API Error",
          message: errorMessage,
        });
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
        
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: error.message,
        });
      } else {
        setErrorMessage("An unknown error occurred");
        
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "An unknown error occurred",
        });
      }
    }
  };

  return (
    <Detail
      markdown={errorMessage || response}
      isLoading={isLoading}
      actions={
        response && !isLoading ? (
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Response" content={response} />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
