#for integrating with various AI services
#supports groq and huggingface models

import os
import json
import requests
import time
import click
from typing import List, Optional, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIProvider:
    # BASE class for AI providers
    
    def generate_plan(self, task_description: str, previous_attempt: Optional[List[str]] = None, 
                     feedback: Optional[str] = None) -> List[str]:

        raise NotImplementedError("Subclasses must implement this method")

class GroqProvider(AIProvider):
    # integration with Groq API
    
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = os.getenv("GROQ_MODEL", "llama3-8b-8192")
        self.max_retries = int(os.getenv("AI_MAX_RETRIES", "3"))
        self.retry_delay = float(os.getenv("AI_RETRY_DELAY", "2.0"))
        self.temperature = float(os.getenv("AI_TEMPERATURE", "0.7"))
        
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set")
            
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
    
    def generate_plan(self, task_description: str, previous_attempt: Optional[List[str]] = None, 
                     feedback: Optional[str] = None) -> List[str]:
        # generate an execution plan using Groq's API
        
        click.echo("\nUsing Groq API for plan generation...")
        #EXTRA: get platform information to include in the prompt
        import platform
        system_os = platform.system()
        is_windows = system_os.lower() == "windows"
        
        #creating the system prompt with instructions
        system_prompt = f"""
        You are an AI assistant that generates execution plans for tasks on a local computer.
        The user's operating system is: {system_os}
        
        Your task is to break down the user's request into a list of executable commands or steps.
        
        Each command should be clear, concise, and executable in a {'Command Prompt or PowerShell' if is_windows else 'terminal'} environment.
        
        For file creation tasks, use the special syntax [WRITE_FILE:filename]content[/WRITE_FILE].
        
        Platform-specific guidelines:
        {'- Use Windows commands (dir instead of ls, type instead of cat, etc.)' if is_windows else '- Use standard Unix/Linux shell commands'}
        {'- Use backslashes for file paths' if is_windows else '- Use forward slashes / for file paths'}
        {'- For PowerShell-specific commands, consider Command Prompt compatibility' if is_windows else ''}
        
        Do not include comments in the commands themselves - only provide executable commands.
        Do not use placeholders - provide complete, working commands.
        
        Format your response as a JSON array of strings, where each string is a command to execute. ALL IN A SINGLE ARRAY, no separate lines. MAKE SURE EVERYTHING IS IN ONE LINE ITSELF, INSIDE ONE ARRAY OF STRINGS, no new lines or line breaks.
        For code blocks that need to be saved to files, use the format: 
        `[WRITE_FILE:filename.ext]content[/WRITE_FILE]`
        """
        
        #creating the user prompt
        user_prompt = f"Task: {task_description}"
        
        if previous_attempt and feedback:
            user_prompt += f"\n\nMy previous plan didn't work:\n"
            user_prompt += "\n".join([f"- {cmd}" for cmd in previous_attempt])
            user_prompt += f"\n\nThe issue was: {feedback}\n\nPlease provide a revised plan."
            
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        #making the request
        for attempt in range(self.max_retries):
            try:
                payload = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": self.temperature,
                    "max_tokens": 1000
                }
                
                debug_mode = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
                if debug_mode:
                    logger.info(f"Sending request to Groq API: {json.dumps(payload, indent=2)}")
                
                response = requests.post(self.api_url, headers=self.headers, json=payload)
                
                if response.status_code == 200:
                    response_data = response.json()
                    plan_text = response_data["choices"][0]["message"]["content"].strip()
                    
                    #IMP: parse the plan_text into a list of commands
                    commands = [cmd.strip() for cmd in plan_text.split('\n') if cmd.strip()]
                    
                    if debug_mode:
                        logger.info(f"Received plan from Groq API: {commands}")
                    
                    return commands
                else:
                    error_msg = f"Groq API request failed with status {response.status_code}: {response.text}"
                    logger.error(error_msg)
                    
                    if attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay)
                    else:
                        raise Exception(error_msg)
                        
            except Exception as e:
                logger.error(f"Error in Groq API request (attempt {attempt+1}/{self.max_retries}): {str(e)}")
                
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise
        
        return []  # return empty list if all attempts fail

class HuggingFaceProvider(AIProvider):
    # integration with HuggingFace Inference API
    
    def __init__(self):
        self.api_key = os.getenv("HUGGINGFACE_API_TOKEN")
        self.model = os.getenv("HUGGINGFACE_MODEL", "mistralai/Mistral-7B-Instruct-v0.2")
        self.max_retries = int(os.getenv("AI_MAX_RETRIES", "3"))
        self.retry_delay = float(os.getenv("AI_RETRY_DELAY", "2.0"))
        self.temperature = float(os.getenv("AI_TEMPERATURE", "0.7"))
        
        if not self.api_key:
            raise ValueError("HUGGINGFACE_API_TOKEN environment variable is not set")
            
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        self.api_url = f"https://api-inference.huggingface.co/models/{self.model}"
    
    def generate_plan(self, task_description: str, previous_attempt: Optional[List[str]] = None, 
                     feedback: Optional[str] = None) -> List[str]:
        # generate an execution plan using huggingface's Inference API
        
        click.echo("\nUsing HuggingFace API for plan generation...")

        import platform
        system_os = platform.system()
        is_windows = system_os.lower() == "windows"
        
        #system prompt
        prompt = f"""
        You are an AI assistant that generates execution plans for tasks on a local computer.
        The user's operating system is: {system_os}
        
        Your task is to break down the user's request into a list of executable commands or steps.
        
        Each command should be clear, concise, and executable in a {'Command Prompt or PowerShell' if is_windows else 'terminal'} environment.
        
        For file creation tasks, use the special syntax [WRITE_FILE:filename]content[/WRITE_FILE].
        
        Platform-specific guidelines:
        {'- Use Windows commands (dir instead of ls, type instead of cat, etc.)' if is_windows else '- Use standard Unix/Linux shell commands'}
        {'- Use backslashes for file paths' if is_windows else '- Use forward slashes / for file paths'}
        {'- For PowerShell-specific commands, consider Command Prompt compatibility' if is_windows else ''}
        
        Do not include comments in the commands themselves - only provide executable commands.
        Do not use placeholders - provide complete, working commands.
        
        Format your response as a JSON array of strings, where each string is a command to execute. ALL IN A SINGLE ARRAY, no separate lines. MAKE SURE EVERYTHING IS IN ONE LINE ITSELF, INSIDE ONE ARRAY OF STRINGS, no new lines or line breaks.
        For code blocks that need to be saved to files, use the format: 
        `[WRITE_FILE:filename.ext]content[/WRITE_FILE]`
        """
        
        #add task description and feedback if available
        prompt += f"Task: {task_description}"
        
        if previous_attempt and feedback:
            prompt += f"\n\nMy previous plan didn't work:\n"
            prompt += "\n".join([f"- {cmd}" for cmd in previous_attempt])
            prompt += f"\n\nThe issue was: {feedback}\n\nPlease provide a revised plan."
            
        prompt += "[/INST]"
        
        #make the request
        for attempt in range(self.max_retries):
            try:
                payload = {
                    "inputs": prompt,
                    "parameters": {
                        "temperature": self.temperature,
                        "max_new_tokens": 1000,
                        "return_full_text": False
                    }
                }
                
                debug_mode = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
                if debug_mode:
                    logger.info(f"Sending request to HuggingFace API: {json.dumps(payload, indent=2)}")
                
                response = requests.post(self.api_url, headers=self.headers, json=payload)
                
                if response.status_code == 200:
                    response_data = response.json()
                    
                    # the response format depends on the model,
                    #so we handle different formats
                    if isinstance(response_data, list) and len(response_data) > 0:
                        if "generated_text" in response_data[0]:
                            plan_text = response_data[0]["generated_text"].strip()
                        else:
                            plan_text = response_data[0]
                    elif isinstance(response_data, dict) and "generated_text" in response_data:
                        plan_text = response_data["generated_text"].strip()
                    else:
                        plan_text = str(response_data).strip()
                    
                    #IMP: parsing the plan_text into a list of commands
                    # First, removing any markdown code blocks if present
                    if "```" in plan_text:
                        code_blocks = plan_text.split("```")
                        for i in range(1, len(code_blocks), 2):
                            if i < len(code_blocks):
                                # getting content after the first line (which might be language specification)
                                lines = code_blocks[i].strip().split("\n")
                                if len(lines) > 1:
                                    code_blocks[i] = "\n".join(lines[1:] if lines[0].lower() in ["bash", "sh", "shell", "cmd", "powershell"] else lines)
                        plan_text = "".join(code_blocks)
                    
                    commands = [cmd.strip() for cmd in plan_text.split('\n') if cmd.strip()]
                    
                    # filter out lines that appear to be comments or explanations
                    commands = [cmd for cmd in commands if not cmd.startswith('#') and not cmd.startswith('//')]
                    
                    if debug_mode:
                        logger.info(f"Received plan from HuggingFace API: {commands}")
                    
                    return commands
                else:
                    error_msg = f"HuggingFace API request failed with status {response.status_code}: {response.text}"
                    logger.error(error_msg)
                    
                    #if model is still loading, wait longer
                    if response.status_code == 503 and "currently loading" in response.text.lower():
                        time.sleep(self.retry_delay * 2)
                    elif attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay)
                    else:
                        raise Exception(error_msg)
                        
            except Exception as e:
                logger.error(f"Error in HuggingFace API request (attempt {attempt+1}/{self.max_retries}): {str(e)}")
                
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise
        
        return []  # return empty list if all attempts fail


def get_ai_provider() -> AIProvider:

    # factory function to create and return the configured AI provider

    provider_name = os.getenv("AI_PROVIDER", "groq").lower()
    
    if provider_name == "groq":
        return GroqProvider()
    elif provider_name == "huggingface":
        return HuggingFaceProvider()
    else:
        logger.warning(f"Unknown AI provider '{provider_name}'. Defaulting to HuggingFace.")
        return HuggingFaceProvider()

def generate_plan(task_description: str, previous_attempt: Optional[List[str]] = None, 
                 feedback: Optional[str] = None) -> List[str]:

    # main fn. that connects the ai_provider.generate_plan to get results

    try:
        provider = get_ai_provider()
        return provider.generate_plan(task_description, previous_attempt, feedback)
    except Exception as e:
        logger.error(f"Error generating plan: {str(e)}")
        return []
