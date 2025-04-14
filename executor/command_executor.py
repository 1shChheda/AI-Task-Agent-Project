import os
import subprocess
import platform
from ai_integration.plan_parser import parse_plan

def execute_command(command, cwd=None):

    #executes a single command safely  
    # returns "success" bool, output of the command or error message

    debug_mode = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
    
    if debug_mode:
        print(f"Executing command: {command}")
    
    #skip empty commands
    if not command or command.strip() == "":
        return True, "Empty command skipped"
    
    try:
        #handle special commands like cd
        if command.lower().startswith("cd "):
            new_dir = command[3:].strip()
            try:
                os.chdir(os.path.expanduser(new_dir))
                return True, f"Changed directory to {os.getcwd()}"
            except Exception as e:
                return False, f"Failed to change directory: {str(e)}"
        
        #execute the command
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=cwd
        )
        
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            return True, stdout
        else:
            return False, f"Command failed with error:\n{stderr}"
            
    except Exception as e:
        return False, f"Error executing command: {str(e)}"

def create_file(filename, content):

    #to create a file with the specified content

    try:
        directory = os.path.dirname(filename)
        if directory and not os.path.exists(directory):
            os.makedirs(directory)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return True, f"File created: {filename}"
    
    except Exception as e:
        return False, f"Error creating file {filename}: {str(e)}"

def execute_plan(plan):

    # main fn. to execute a plan of commands

    # FIRST parse and validate the plan
    safe_commands, file_operations, unsafe_commands = parse_plan(plan)
    
    if unsafe_commands:
        unsafe_list = "\n".join([f"- {cmd}" for cmd in unsafe_commands])
        return False, f"Plan contains potentially unsafe commands:\n{unsafe_list}"
    
    #handle file operations first
    file_results = []
    all_success = True
    
    for filename, content in file_operations.items():
        success, message = create_file(filename, content)
        file_results.append(message)
        if not success:
            all_success = False
    
    #execute each command
    cmd_results = []
    for command in safe_commands:
        success, output = execute_command(command)
        cmd_results.append(f"Command: {command}\n{'Success:' if success else 'Error:'} {output}")
        
        if not success:
            all_success = False
    
    # Combine results
    combined_output = "\n\n".join(file_results + cmd_results)
    
    return all_success, combined_output