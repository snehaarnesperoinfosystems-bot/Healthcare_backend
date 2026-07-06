# app/services/wellness_service.py
import os
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List

class WellnessResponse(BaseModel):
    detected_mood: str = Field(description="The primary emotion detected, e.g., Stressed, Anxious, Depressed, Hopeless")
    stress_level: str = Field(description="Low, Medium, or High")
    recommendation: str = Field(description="A clinical recommendation or a NEW follow-up question for the doctor to ask")
    suggested_replies: List[str] = Field(description="2 to 4 short, realistic options the doctor can click to answer the question, or empty list if assessment is complete")

class WellnessService:
    def __init__(self):
        try:
            self.llm = Ollama(model="medgemma:latest") # Or gemma3:4b
            self.parser = JsonOutputParser(pydantic_object=WellnessResponse)
            
            # Stricter prompt to prevent looping and force conclusions
            self.template = """
            You are a clinical Mental Wellness AI Assistant talking to a doctor.
            Your goal is to assess the patient step-by-step and then provide a clinical solution.
            
            STRICT RULES:
            1. DO NOT repeat any question that is already in the Conversation History. 
            2. If the doctor's input answers your previous question, acknowledge it briefly and ask a DIFFERENT question about a NEW symptom (e.g., if you asked about sleep, ask about appetite or focus next).
            3. MAXIMUM 4 QUESTIONS: After asking about 3 or 4 different symptoms, you MUST stop asking questions.
            4. WHEN TO CONCLUDE: Once you have enough context (or if the doctor asks for a solution), provide a final clinical summary and actionable wellness recommendation (e.g., therapy referral, medication review, lifestyle changes).
            5. SAFETY CHECK: If the patient mentions "harm", "suicidal", or "hopeless", immediately tell the doctor to conduct an urgent safety assessment and provide crisis resources.
            
            Conversation History:
            {context}
            
            Doctor's latest input: {user_input}
            
            {format_instructions}
            """
            self.prompt = PromptTemplate.from_template(self.template)
            self.chain = self.prompt | self.llm | self.parser
        except Exception as e:
            print(f"Error initializing WellnessService: {e}")
            self.chain = None

    def analyze_mood(self, user_input: str, context: str = "") -> dict:
        if not self.chain:
            return {"error": "Model not initialized. Is Ollama running?"}
        try:
            response = self.chain.invoke({
                "user_input": user_input,
                "context": context if context else "No previous history.",
                "format_instructions": self.parser.get_format_instructions()
            })
            return response
        except Exception as e:
            return {"error": str(e)}

wellness_service = WellnessService()