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
            
            Based on the history, provide a clinical summary of the patient's mental state.
            DO NOT write a giant paragraph. Use Markdown formatting to make it look like a professional medical report.
            
            You MUST use the EXACT 4 headings below. DO NOT skip any heading (especially Lifestyle Changes):
            
            **Clinical Summary:** 
            (1-2 sentences summarizing the patient's state and triggers based on the chat)
            
            **Therapy Recommendations:** 
            * (1-2 bullet points suggesting therapy like CBT or counseling)
            
            **Yoga & Exercise:** 
            * (1-2 bullet points with specific actions like deep breathing or 30-min walks)
            
            **Lifestyle Changes:** 
            * (1-2 bullet points for sleep hygiene, diet, or habits)
            
            Respond ONLY in simple JSON with these exact keys:
            "detected_mood" (string), 
            "stress_level" (string), 
            "recommendation" (string, containing the formatted Markdown summary with all 4 headings), 
            "suggested_replies" (empty array []).
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
           
            if not isinstance(data.get("suggested_replies"), list):
                data["suggested_replies"] = []
               
            return data
           
        except Exception as e:
            return {"error": f"Failed to parse AI response: {str(e)}"}
 
wellness_service = WellnessService()