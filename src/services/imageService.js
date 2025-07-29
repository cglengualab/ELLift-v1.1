// This function will send a prompt to our new image generation API route
export const generateImage = async (prompt) => {
  console.log("Sending prompt to our backend:", prompt);

  const response = await fetch('/api/generateImage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate image');
  }

  const data = await response.json();
  return data.imageUrl; // Return the URL of the generated image
};
