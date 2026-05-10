import { Type } from "@google/genai";

export function getToolDeclarations(): Array<Record<string, unknown>> {
  return [
    {
      name: "search_properties",
      description:
        "Search active properties for the caller's provided address, street, city, or property clue.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING }
        },
        required: ["query"]
      }
    },
    {
      name: "get_property_details",
      description: "Fetch verified details for a specific property.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          property_id: { type: Type.STRING }
        },
        required: ["property_id"]
      }
    },
    {
      name: "calculate_qualification",
      description:
        "Calculate qualification status after collecting adult count, credit, and income answers.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          property_id: { type: Type.STRING },
          adult_count: { type: Type.NUMBER },
          all_credit_over_600: { type: Type.BOOLEAN },
          credit_scores: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER }
          },
          income_meets_3x_rent: { type: Type.BOOLEAN },
          wants_cosigner: { type: Type.BOOLEAN },
          wants_increased_deposit: { type: Type.BOOLEAN }
        },
        required: ["property_id", "adult_count", "income_meets_3x_rent"]
      }
    },
    {
      name: "find_showing_slots",
      description:
        "Find available Google Calendar slots for a property showing. Use this whenever the caller asks what showing dates, tour times, appointment times, viewing slots, earliest showing, or latest showing are available.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          property_id: { type: Type.STRING },
          preferred_start: {
            type: Type.STRING,
            description:
              "Optional ISO date-time if the caller requested a starting date or time window."
          },
          preferred_end: {
            type: Type.STRING,
            description:
              "Optional ISO date-time if the caller requested an ending date or time window."
          }
        },
        required: ["property_id"]
      }
    },
    {
      name: "book_showing",
      description: "Book a showing on the connected Google Calendar.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          property_id: { type: Type.STRING },
          start: { type: Type.STRING },
          end: { type: Type.STRING },
          caller_name: { type: Type.STRING },
          caller_phone: { type: Type.STRING }
        },
        required: ["property_id", "start", "end"]
      }
    },
    {
      name: "transfer_call",
      description: "Transfer the caller to a real person.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          reason: {
            type: Type.STRING,
            enum: [
              "maintenance",
              "general_office",
              "human_requested",
              "property_unclear",
              "immediate_access",
              "unsafe_or_out_of_scope"
            ]
          }
        },
        required: ["reason"]
      }
    },
    {
      name: "end_call",
      description: "End the call after wrapping up.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          outcome: { type: Type.STRING }
        },
        required: ["outcome"]
      }
    },
    {
      name: "log_call_event",
      description:
        "Record a structured call event or captured field. Use this immediately after capturing caller name, phone, property address, desired move-in date, desired length of stay, callback preference, showing request, or application interest.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          event_type: { type: Type.STRING },
          payload: {
            type: Type.OBJECT,
            description:
              "Structured values using snake_case or camelCase keys, for example caller_name, caller_phone, property_address, desired_move_in_date, desired_length_of_stay, showing_requested, requested_showing_time, callback_requested, application_encouraged, is_lead."
          }
        },
        required: ["event_type", "payload"]
      }
    }
  ];
}
