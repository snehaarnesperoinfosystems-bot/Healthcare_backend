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
           
            Instructions:
            1. Provide a concise clinical summary of the patient's mental state based on the history.
            2. Provide actionable recommendations.
            3. You MUST use Markdown formatting (e.g., **Bold**, bullet points `- `, and line breaks `\n`) to make it highly readable.
            4. Include specific suggestions for:
               - Therapy (e.g., CBT, counseling)
               - Yoga/Exercise (e.g., deep breathing, walking)
               - Lifestyle changes (e.g., sleep hygiene, diet)
           
            Respond ONLY in valid JSON with these exact keys:
            "detected_mood" (string, e.g., "Mixed anxiety and irritability"),
            "stress_level" (string, e.g., "Moderate to High"),
            "recommendation" (string, MUST BE MARKDOWN FORMATTED containing the summary and all tips),
            "suggested_replies" (empty array []).
            """
        else:
            # NORMAL PROMPT FOR ASSESSMENT
            prompt = f"""
            You are a clinical Mental Wellness AI Assistant talking to a doctor.
            Assess the patient step-by-step.
           
            STRICT RULES:
            1. DYNAMIC ANALYSIS: Evaluate `detected_mood` and `stress_level` STRICTLY based on the "Doctor's input". Do not just repeat previous states. If input says "struggling to concentrate", mood might be "Overwhelmed" and stress "High".
            2. NO REPETITION: Read the "History". DO NOT ask any question that is already present in the history.
            3. PROGRESSION: If the input answers your previous question, acknowledge it briefly and ask a DIFFERENT question about a NEW symptom (e.g., sleep -> appetite -> focus -> physical tension).
            4. CONCLUSION: If 3 or more symptoms have already been discussed in history, STOP asking questions. Provide a final clinical summary and actionable wellness recommendation.
            5. The "recommendation" MUST be EXACTLY ONE SINGLE QUESTION (unless providing a summary).
            6. The "suggested_replies" MUST be 3 short, realistic PATIENT ANSWERS.
            7. SAFETY: If the patient mentions "harm" or "hopeless", tell the doctor to do an urgent safety check.
           
            History:
            {context}
           
            Doctor's input: {user_input}
           
            Respond ONLY in valid JSON:
            "detected_mood" (string),
            "stress_level" (string),
            "recommendation" (string),
            "suggested_replies" (array of 3 strings).
            """
 
        try:
            response_text = self.llm.invoke(prompt)
            
            # 🟢 Clean markdown formatting if the model adds it accidentally
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
                
            data = json.loads(response_text)
           
            if not isinstance(data.get("suggested_replies"), list):
                data["suggested_replies"] = []
               
            return data
           
        except Exception as e:
            print(f"Error parsing wellness response: {e}")
            return {
                "detected_mood": "Unknown",
                "stress_level": "Unknown",
                "recommendation": "I see. Can you tell me more about how this is affecting your daily routine?",
                "suggested_replies": ["It's hard to function.", "I'm managing okay.", "I feel overwhelmed."]
            }
 
wellness_service = WellnessService()