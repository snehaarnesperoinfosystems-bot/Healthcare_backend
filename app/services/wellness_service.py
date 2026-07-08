# app/services/wellness_service.py
import json
from langchain_community.llms import Ollama

class WellnessService:
    def __init__(self):
        try:
            self.llm = Ollama(model="gemma3:4b", format="json") # Change to 1b if too slow
        except Exception as e:
            print(f"Error initializing WellnessService: {e}")
            self.llm = None

    def analyze_mood(self, user_input: str, context: str = "") -> dict:
        if not self.llm:
            return {"error": "Model not initialized. Is Ollama running?"}
        
        # SPECIAL PROMPT FOR SUMMARY
        if "generate final summary" in user_input.lower():
            prompt = f"""
            You are a clinical Mental Wellness AI Assistant.
            The doctor has finished assessing the patient and needs a final clinical summary.
            
            Conversation History:
            {context}
            
            STRICT INSTRUCTIONS FOR FORMATTING:
            1. You MUST provide the formatted text inside the "recommendation" key.
            2. Use `\n` for new lines to ensure proper Markdown rendering.
            3. You MUST use EXACTLY these 4 headings in the "recommendation" in this order:
               ### **Clinical Summary:**
               ### **Therapy Recommendations:**
               ### **Yoga & Exercise:**
               ### **Lifestyle Changes:**
            4. Under each heading, provide 1-2 concise bullet points starting with `*`.
            
            EXAMPLE OF EXPECTED JSON OUTPUT:
            {{
              "detected_mood": "Anxious",
              "stress_level": "High",
              "recommendation": "### **Clinical Summary:**\n* Patient exhibits signs of work-related anxiety and mild sleep disturbance.\n* Triggers include high workload and lack of rest.\n\n### **Therapy Recommendations:**\n* Initiate Cognitive Behavioral Therapy (CBT) focusing on anxiety management.\n* Recommend a follow-up in 2 weeks to assess progress.\n\n### **Yoga & Exercise:**\n* 15 minutes of deep breathing exercises before bed.\n* 30-minute brisk walk daily to reduce cortisol levels.\n\n### **Lifestyle Changes:**\n* Maintain strict sleep hygiene (no screens 1 hour before bed).\n* Reduce caffeine intake after 2 PM.",
              "suggested_replies": []
            }}
            
            Now, generate the final JSON response based on the conversation history. Respond ONLY with valid JSON.
            """
        else:
            # NORMAL PROMPT FOR ASSESSMENT
            prompt = f"""
            You are a clinical Mental Wellness AI Assistant talking to a doctor.
            Assess the patient step-by-step.
            
            STRICT RULES:
            1. DO NOT repeat questions from the history.
            2. The "recommendation" MUST be EXACTLY ONE SINGLE QUESTION.
            3. The "suggested_replies" MUST be 3 short, realistic PATIENT ANSWERS.
            4. SAFETY: If the patient mentions "harm" or "hopeless", tell the doctor to do an urgent safety check.
            
            History:
            {context}
            
            Doctor's input: {user_input}
            
            Respond ONLY in simple JSON:
            "detected_mood" (string),
            "stress_level" (string),
            "recommendation" (string),
            "suggested_replies" (array of 3 strings).
            """

        try:
            response_text = self.llm.invoke(prompt)
            data = json.loads(response_text)
            
            # Ensure suggested_replies is always a list
            if not isinstance(data.get("suggested_replies"), list):
                data["suggested_replies"] = []
            
            # Ensure recommendation is a string
            if not isinstance(data.get("recommendation"), str):
                data["recommendation"] = "Could not generate recommendation."
                
            return data
            
        except Exception as e:
            return {"error": f"Failed to parse AI response: {str(e)}", "recommendation": "Error generating response.", "suggested_replies": []}

wellness_service = WellnessService()