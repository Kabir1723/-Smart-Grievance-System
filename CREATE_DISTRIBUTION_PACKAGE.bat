@echo off
title Creating Distribution Package for CD/Google Drive
color 0A

echo.
echo ========================================================
echo     CREATING DISTRIBUTION PACKAGE FOR CD/DRIVE
echo ========================================================
echo.

echo [Step 1/5] Creating distribution folder...
if exist "DISTRIBUTION_PACKAGE" rmdir /s /q "DISTRIBUTION_PACKAGE"
mkdir "DISTRIBUTION_PACKAGE"
echo ✓ Distribution folder created

echo.
echo [Step 2/5] Copying executable file...
copy "backend-node\grievance-system.exe" "DISTRIBUTION_PACKAGE\" >nul
echo ✓ Executable copied

echo.
echo [Step 3/5] Copying configuration files...
copy "backend-node\.env" "DISTRIBUTION_PACKAGE\" >nul
copy "backend-node\package.json" "DISTRIBUTION_PACKAGE\" >nul
echo ✓ Configuration files copied

echo.
echo [Step 4/5] Copying frontend build (public folder)...
xcopy "backend-node\public" "DISTRIBUTION_PACKAGE\public\" /E /I /H /Y >nul
echo ✓ Frontend files copied

echo.
echo [Step 5/5] Copying documentation and startup files...
copy "VoiceIt_Project_Guide.md" "DISTRIBUTION_PACKAGE\" >nul
copy "AI_AND_ALGORITHMS.md" "DISTRIBUTION_PACKAGE\" >nul
echo ✓ Documentation copied

echo.
echo [Creating README for distribution...]
(
echo # VoiceIt - Smart Public Grievance Escalation System
echo ## Distribution Package
echo.
echo ### What's Included:
echo - grievance-system.exe ^(Main Application^)
echo - .env ^(Configuration File^)
echo - public/ ^(Frontend Files^)
echo - VoiceIt_Project_Guide.md ^(Complete Guide^)
echo - AI_AND_ALGORITHMS.md ^(Technical Documentation^)
echo.
echo ### System Requirements:
echo 1. Windows 7/8/10/11
echo 2. MySQL Server ^(XAMPP recommended^)
echo 3. 100MB free disk space
echo.
echo ### Installation Steps:
echo.
echo 1. **Install MySQL:**
echo    - Download and install XAMPP from: https://www.apachefriends.org
echo    - Open XAMPP Control Panel
echo    - Click "Start" next to MySQL
echo.
echo 2. **Configure Database:**
echo    - Open the .env file in Notepad
echo    - Update these settings:
echo      * DB_HOST=localhost
echo      * DB_USER=root
echo      * DB_PASSWORD=^(your MySQL password^)
echo      * DB_NAME=grievance_system
echo.
echo 3. **Run the Application:**
echo    - Double-click grievance-system.exe
echo    - The application will:
echo      * Automatically create the database
echo      * Start the backend server on port 5000
echo      * Open your browser to http://localhost:5000
echo.
echo 4. **First Time Setup:**
echo    - The database tables will be created automatically
echo    - Default admin credentials:
echo      * Email: admin@grievance.com
echo      * Password: admin123
echo.
echo ### Important Notes:
echo - Keep MySQL running while using the application
echo - The .env file contains your database credentials
echo - The public folder contains the web interface
echo - Do NOT delete any files from this package
echo.
echo ### Troubleshooting:
echo - If the app doesn't start, check if MySQL is running
echo - If database connection fails, verify .env credentials
echo - Port 5000 must be available ^(not used by other apps^)
echo.
echo ### Support:
echo For detailed instructions, see VoiceIt_Project_Guide.md
echo.
) > "DISTRIBUTION_PACKAGE\README.txt"
echo ✓ README created

echo.
echo [Creating startup script...]
(
echo @echo off
echo title VoiceIt - Smart Public Grievance System
echo color 0E
echo.
echo ========================================================
echo        VOICEIT - GRIEVANCE ESCALATION SYSTEM
echo ========================================================
echo.
echo Starting application...
echo.
echo IMPORTANT: Make sure MySQL is running in XAMPP!
echo.
echo Backend will start on: http://localhost:5000
echo.
timeout /t 3 /nobreak ^>nul
echo.
echo Opening application...
start grievance-system.exe
echo.
echo ========================================================
echo   Application: http://localhost:5000
echo   Admin Panel: http://localhost:5000/admin
echo   
echo   Default Admin Login:
echo   Email:    admin@grievance.com
echo   Password: admin123
echo ========================================================
echo.
echo Keep this window open while using the application!
echo Press any key to stop the application...
pause ^>nul
) > "DISTRIBUTION_PACKAGE\START_VOICEIT.bat"
echo ✓ Startup script created

echo.
echo [Creating .env template...]
(
echo # Database Configuration
echo DB_HOST=localhost
echo DB_USER=root
echo DB_PASSWORD=root123
echo DB_NAME=grievance_system
echo JWT_SECRET_KEY=grievance-system-secret-key-2024
echo PORT=5000
echo.
echo # Admin Notification Settings
echo ADMIN_PHONE=9566780485
echo ADMIN_EMAIL=karthimurthy2406@gmail.com
echo.
echo # Email Configuration ^(Optional - for notifications^)
echo EMAIL_HOST=smtp.gmail.com
echo EMAIL_PORT=587
echo EMAIL_USER=karthimurthy2406@gmail.com
echo EMAIL_PASSWORD=your-app-password-here
echo.
echo # SMS Configuration ^(Optional - for notifications^)
echo FAST2SMS_API_KEY=your-fast2sms-api-key
echo TWILIO_ACCOUNT_SID=your-twilio-account-sid
echo TWILIO_AUTH_TOKEN=your-twilio-auth-token
echo TWILIO_PHONE_NUMBER=your-twilio-phone-number
) > "DISTRIBUTION_PACKAGE\.env.example"
echo ✓ .env template created

echo.
echo ========================================================
echo                  PACKAGE CREATED SUCCESSFULLY!
echo ========================================================
echo.
echo Location: %CD%\DISTRIBUTION_PACKAGE
echo.
echo Package Contents:
dir "DISTRIBUTION_PACKAGE" /B
echo.
echo Package Size:
powershell -command "'{0:N2} MB' -f ((Get-ChildItem -Path 'DISTRIBUTION_PACKAGE' -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB)"
echo.
echo ========================================================
echo   READY TO UPLOAD TO CD/GOOGLE DRIVE!
echo ========================================================
echo.
echo Next Steps:
echo 1. Compress DISTRIBUTION_PACKAGE folder to ZIP
echo 2. Upload to Google Drive or burn to CD
echo 3. Share with users along with README.txt
echo.
pause
