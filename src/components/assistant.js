"use strict";

/**
 * CarbonAssistant — wraps the Anthropic Claude API to provide
 * context-aware, personalized carbon footprint advice.
 *
 * The assistant receives the user's calculated footprint data
 * and generates targeted, actionable recommendations.
 */

const SYSTEM_PROMPT = `You are EcoGuide, a friendly and knowledgeable carbon footprint assistant.
Your job is to help users understand their carbon footprint and make practical reductions.

Guidelines:
- Be encouraging and positive, never preachy or guilt-inducing
- Give specific, actionable advice based on the user's actual footprint data
- Use simple language; avoid jargon
- Reference the user's data when relevant (e.g., "Your transport footprint of X kg is above average")
- Suggest 2-3 concrete actions per response maximum
- When asked, compare against India average (1800 kg/year) and Paris target (2300 kg/year)
- Always validate user questions; if a question is off-topic, gently redirect to carbon topics
- Output in plain text only, no markdown formatting

Remember: small, consistent actions matter more than perfect solutions.`;

/**
 * Sends a message to the Claude API with footprint context.
 *
 * @param {string} userMessage - The user's input message
 * @param {Object|null} footprintContext - User's calculated footprint data
 * @param {Array} conversationHistory - Previous messages [{ role, content }, ...]
 * @returns {Promise<{ success: boolean, reply?: string, error?: string }>}
 */
async function sendMessage(userMessage, footprintContext, conversationHistory = []) {
  // Input sanitisation
  if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
    return { success: false, error: "Message cannot be empty." };
  }

  const sanitizedMessage = userMessage.trim().slice(0, 1000); // limit message length

  // Build contextual system message
  let systemWithContext = SYSTEM_PROMPT;
  if (footprintContext && typeof footprintContext === "object") {
    const ctx = buildContextString(footprintContext);
    systemWithContext += `\n\nUser's current carbon footprint data:\n${ctx}`;
  }

  // Build messages array (keep last 10 turns for context window efficiency)
  const recentHistory = conversationHistory.slice(-10);
  const messages = [
    ...recentHistory,
    { role: "user", content: sanitizedMessage },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // API key injected by platform — do not hardcode here
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemWithContext,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `API error ${response.status}: ${errorData.error?.message || "Unknown error"}`,
      };
    }

    const data = await response.json();
    const textBlock = data.content?.find((b) => b.type === "text");
    const reply = textBlock?.text?.trim() || "I couldn't generate a response. Please try again.";

    return { success: true, reply };
  } catch (err) {
    return {
      success: false,
      error: `Network error: ${err.message || "Failed to reach AI service"}`,
    };
  }
}

/**
 * Formats footprint context data into a readable string for the system prompt.
 * @param {Object} footprintContext
 * @returns {string}
 */
function buildContextString(footprintContext) {
  const lines = [];

  if (typeof footprintContext.totalKgCO2ePerYear === "number") {
    lines.push(`Total annual footprint: ${footprintContext.totalKgCO2ePerYear} kg CO2e`);
  }

  if (footprintContext.byCategory && typeof footprintContext.byCategory === "object") {
    lines.push("Breakdown by category:");
    for (const [cat, val] of Object.entries(footprintContext.byCategory)) {
      if (typeof val === "number") {
        lines.push(`  - ${cat}: ${val} kg CO2e`);
      }
    }
  }

  if (footprintContext.dietType) {
    lines.push(`Diet type: ${footprintContext.dietType}`);
  }

  return lines.join("\n");
}

module.exports = { sendMessage, buildContextString };
