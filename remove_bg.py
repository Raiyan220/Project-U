from PIL import Image
import sys

def remove_black_background(input_path, output_path):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        new_data = []
        for item in datas:
            # If pixel is black (or very close to it), make it transparent
            # Adjust threshold if needed. < 20 is a safe bet for deep blacks.
            if item[0] < 30 and item[1] < 30 and item[2] < 30: 
                new_data.append((255, 255, 255, 0)) # Fully transparent
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Successfully saved to {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_black_background("logo_to_process.png", "t_logo.png")
