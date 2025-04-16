#executes commands safely and handles file operations

import os
import subprocess
import tempfile
import shlex
import platform
from ai_integration.plan_parser import parse_plan

def is_windows():
    #check if the system is Windows
    return platform.system().lower() == "windows"

def execute_command(command, cwd=None):

    #executes a single command safely  
    # returns "success" bool, output of the command or error message

    debug_mode = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
    
    if debug_mode:
        print(f"Executing command: {command}")
    
    #skip empty commands
    if not command or command.strip() == "":
        return True, "Empty command skipped"
    
    #cleaning the commands
    # removing quotes if they wrap the entire command
    command = command.strip()
    if (command.startswith('"') and command.endswith('"')) or \
       (command.startswith("'") and command.endswith("'")):
        command = command[1:-1]
    
    try:
        #handle different shell requirements for Windows vs Unix
        is_windows = platform.system().lower() == "windows"
        
        #handle special commands like cd
        if command.lower().startswith("cd "):
            new_dir = command[3:].strip()
            if (new_dir.startswith('"') and new_dir.endswith('"')) or \
               (new_dir.startswith("'") and new_dir.endswith("'")):
                new_dir = new_dir[1:-1]  #removing surrounding quotes
            
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
    debug_mode = os.getenv('DEBUG_MODE', 'False').lower() == 'true'
    
    if debug_mode:
        print(f"Creating file: {filename}")
        print(f"Content length: {len(content)} characters")
    
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
        #Tweak: there were issues in formatting the array brackets '[' ']' while parsing the generated commands.
        # SO, skipping commands that are likely artifacts of parsing
        if command.startswith('[') and command.endswith(']'):
            continue
        
        success, output = execute_command(command)
        cmd_results.append(f"Command: {command}\n{'Success:' if success else 'Error:'} {output}")
        
        if not success:
            all_success = False
    
    # Combine results
    combined_output = "\n\n".join(file_results + cmd_results)
    
    # if we have successful file creation but command errors, we might still consider it
    # a partial success - especially for file creation tasks
    if file_operations and all(result.startswith("File created:") for result in file_results):
        # check if this was primarily a file creation task
        return True, combined_output
    
    return all_success, combined_output