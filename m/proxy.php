<?php

function fetchMedia()
{
    // Check if the 'url' parameter is set in the POST request
    if (isset($_POST['url'])) {
        $url = $_POST['url'];
        error_log('Fetching media from URL: ' . $url);

        // Validate the URL
        if (filter_var($url, FILTER_VALIDATE_URL)) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Disable SSL verification for simplicity

            $response = curl_exec($ch);

            // Get the HTTP code and content type after executing the request
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            curl_close($ch);

            if ($httpCode == 200) {
                header('Content-Type: ' . $contentType);
                echo $response;
            } else {
                echo 'Error ' . $httpCode;
            }
        } else {
            // Invalid URL
            echo 'Invalid URL';
        }
    } else {
        // URL parameter not set
        echo 'URL parameter is required';
    }
}

// Call the function to handle the request
fetchMedia();
?>