import { GoogleGenAI, Content, Part } from "@google/genai";

interface GeminiDiagnosticResult {
  success: boolean;
  message: string;
  latency?: number;
  details?: string;
}

export const diagnoseGeminiConnection = async (): Promise<GeminiDiagnosticResult> => {
  const startTime = performance.now();
  
  try {
    // Ensure we rely on process.env.API_KEY as per guidelines
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return {
        success: false,
        message: "API Key no encontrada en process.env.API_KEY",
        details: "La variable de entorno API_KEY es requerida para realizar el diagnóstico de Gemini."
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Use gemini-2.5-flash for a quick basic text task diagnostic
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Respond with "OK" if you receive this.',
    });

    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    return {
      success: true,
      message: `Conexión exitosa (${latency}ms)`,
      latency,
      details: `Respuesta del modelo: "${response.text?.trim()}"`
    };

  } catch (error: any) {
    console.error("Gemini diagnostic error:", error);
    return {
      success: false,
      message: error.message || "Error de conexión con Gemini API",
      details: JSON.stringify(error, null, 2)
    };
  }
};

export const sendChatMessage = async (message: string, history: Content[]) => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: history,
      config: {
        systemInstruction: "Eres un asistente de inteligencia artificial útil y amigable en un chat grupal. Responde de manera concisa y útil.",
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error: any) {
    console.error("Chat error:", error);
    throw error;
  }
};