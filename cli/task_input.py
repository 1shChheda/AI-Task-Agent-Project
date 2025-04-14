#handles capturing and validating user task descriptions

import click
import re

def get_task_description():

    #take task description from user
    # and validate it for length and dangerous operations

    click.echo("\nWelcome to AI Task Agent")
    click.echo("================")
    click.echo("Describe a task you'd like the AI to help you with.")
    click.echo("Examples:")
    click.echo("  - Create a simple Python web server and run it")
    click.echo("  - Generate a React component for a contact form")
    click.echo("  - Find and list all .txt files in the current directory")
    
    task = click.prompt("\nEnter your task", type=str)
    
    #basic validation
    if not task or len(task.strip()) < 5:
        click.echo("WARNING: Task description is too short. Please provide more details.")
        return None
    
    #checking for potentially dangerous operations
    dangerous_patterns = [
        r"rm\s+-rf", r"format\s+disk", r"del\s+/[Ff]", r"sudo\s+rm",
        r"mkfs", r"fdisk", r"dd\s+if", r":(){ :\|:& };:",
        r"rmdir\s+/[sS]", r"format\s+[a-zA-Z]:", r"del\s+/[aAsSqQ]"
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, task, re.IGNORECASE):
            click.echo("WARNING: Task contains potentially dangerous operations and cannot be processed.")
            return None
            
    #removing extra whitespace, etc.
    task = " ".join(task.split())
    
    return task

def parse_task_context(task_description):

    #to extract context from the task description
    #such as programming language, target directory, or other relevant params
    # returns a dictionary with the extracted context

    context = {
        "language": None,
        "directory": ".",
        "framework": None,
    }
    
    #extract programming language
    language_patterns = {
        r"python|\.py": "python",
        r"javascript|node\.?js|\.js": "javascript",
        r"typescript|\.ts": "typescript",
        r"java|\.java": "java",
        r"c\+\+|cpp|\.cpp": "cpp",
        r"c#|\.cs|csharp": "csharp",
        r"go|golang|\.go": "go",
        r"rust|\.rs": "rust",
        r"ruby|\.rb": "ruby",
        r"php|\.php": "php",
        r"html|\.html": "html",
        r"css|\.css": "css",
        r"shell|bash|\.sh": "bash",
    }
    
    for pattern, lang in language_patterns.items():
        if re.search(pattern, task_description, re.IGNORECASE):
            context["language"] = lang
            break
            
    #extract framework
    framework_patterns = {
        r"react": "react",
        r"angular": "angular",
        r"vue": "vue",
        r"django": "django",
        r"flask": "flask",
        r"express": "express",
        r"spring": "spring",
        r"rails": "rails",
        r"laravel": "laravel",
    }
    
    for pattern, framework in framework_patterns.items():
        if re.search(pattern, task_description, re.IGNORECASE):
            context["framework"] = framework
            break
            
    #extract directory if specified
    dir_match = re.search(r"in\s+(?:dir(?:ectory)?|folder)\s+[\"']?([^\"']+)[\"']?", 
                         task_description, re.IGNORECASE)
    if dir_match:
        context["directory"] = dir_match.group(1).strip()
    
    return context