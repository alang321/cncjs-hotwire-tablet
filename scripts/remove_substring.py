import sys

def remove_substring(file_path, substring_to_remove):
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        if substring_to_remove in content:
            modified_content = content.replace(substring_to_remove, '')

            with open(file_path, 'w') as file:
                file.write(modified_content)

            print(f'Successfully removed "{substring_to_remove}" from {file_path}')

    except FileNotFoundError:
        print(f'Error: File not found - {file_path}')

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <filename> <substring_to_remove>")
    else:
        filename = sys.argv[1]
        substring_to_remove = sys.argv[2]
        remove_substring(filename, substring_to_remove)
