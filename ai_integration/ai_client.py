import os
import json
import requests
import click
from typing import List, Optional

def generate_plan(task_description: str, previous_attempt: Optional[List[str]] = None, 
                 feedback: Optional[str] = None) -> List[str]:

    #generates execution plan for the given task using AI

    # dummy implementation - will be connected to AI APIs later
    click.echo("Generating execution plan... (Placeholder)")
    
    #mock plan for testing
    plan = [
        "echo Starting task execution",
        "mkdir test_output",
        "echo Vansh's Agent COMPLETED the task! > test_output\\result.txt",
        "type test_output\\result.txt"
    ]
    
    return plan