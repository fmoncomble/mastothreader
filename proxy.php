<?php

function fetchMedia()
{
    if (isset($_POST['url'])) {
        $url = $_POST['url'];

        $host = parse_url($url, PHP_URL_HOST);
        $referrer = parse_url($url, PHP_URL_SCHEME) . '://' . $host;

        $headers = [
            'Referer: ' . $referrer,
            'Host: ' . $host,
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        ];

        if (filter_var($url, FILTER_VALIDATE_URL)) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

            $response = curl_exec($ch);

            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            curl_close($ch);

            http_response_code($httpCode);
            header('Content-Type: ' . $contentType);
            if ($httpCode != 200) {
                error_log('Error fetching WP URL. HTTP Code: ' . $httpCode);
                echo 'Error fetching WP URL. HTTP Code: ' . $httpCode;
            } else {
                error_log('Successfully fetched WP URL.');
                echo $response;
            }
        } else {
            echo 'Invalid URL';
        }
    } else {
        echo 'URL parameter is required';
    }
}

fetchMedia();
