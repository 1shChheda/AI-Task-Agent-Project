#handles user feedback and task refinement

import click
import re
import os
from datetime import datetime

def handle_feedback(task_description, plan, output, previous_feedback=None):

    # main fn. to get user feedback on a failed task execution

    click.echo("\nPlease provide feedback on what went wrong:")
    click.echo("This will help the AI refine its approach.")
    
    if previous_feedback:
        click.echo(f"\nYour previous feedback was: \"{previous_feedback}\"")
    
    #suggest some common issues to help the user
    click.echo("\nCommon issues:")
    click.echo("1. Missing dependencies")
    click.echo("2. File permissions")
    click.echo("3. Incorrect syntax or command format")
    click.echo("4. Incomplete implementation")
    click.echo("5. Environment-specific issues")
    
    #get detailed feedback from the user
    feedback = click.prompt("\nWhat went wrong? Please be specific", type=str)
    
    log_feedback(task_description, plan, output, feedback)
    
    return feedback

def log_feedback(task_description, plan, output, feedback):

    #Log feedback for future analysis

    debug_mode = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
    
    if debug_mode:
        os.makedirs('logs', exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = f"logs/feedback_{timestamp}.log"
        
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"Task: {task_description}\n\n")
            f.write("Plan:\n")
            for idx, step in enumerate(plan, 1):
                f.write(f"{idx}. {step}\n")
            f.write("\nOutput:\n")
            f.write(output)
            f.write("\nFeedback:\n")
            f.write(feedback)
        
        print(f"Feedback logged to {log_file}")

def analyze_feedback(feedback):

    #extra: analyze feedback to extract specific issues

    issues = {
        "dependency": False,
        "permission": False,
        "syntax": False,
        "implementation": False,
        "environment": False,
        "specific_error": None
    }
    
    #Looking for common patterns in feedback
    if re.search(r"(missing|not found|no module|import|install|dependency)", feedback, re.IGNORECASE):
        issues["dependency"] = True
    
    if re.search(r"(permission|access denied|not allowed|sudo|administrator)", feedback, re.IGNORECASE):
        issues["permission"] = True
    
    if re.search(r"(syntax|typo|invalid|error|exception)", feedback, re.IGNORECASE):
        issues["syntax"] = True
        
    if re.search(r"(incomplete|not working|doesn't work|partial|missing feature)", feedback, re.IGNORECASE):
        issues["implementation"] = True
        
    if re.search(r"(windows|mac|linux|os|platform|version)", feedback, re.IGNORECASE):
        issues["environment"] = True
    
    #extract specific error messages
    error_match = re.search(r"error:?\s*(.+?)(?:$|\n|\.)", feedback, re.IGNORECASE)
    if error_match:
        issues["specific_error"] = error_match.group(1).strip()
    
    return issues