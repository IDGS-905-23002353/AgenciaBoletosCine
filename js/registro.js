const API_URL = 'http://localhost:5000/api';
const formRegister = document.getElementById('form-register');

formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/registro`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Usuario registrado exitosamente. Ahora puedes iniciar sesión.');
            // Redirigir a la página de login tras un registro exitoso
            window.location.href = 'login.html'; 
        } else {
            // Mostrar mensaje de error del backend (ej. "El nombre de usuario ya existe")
            alert(`Error: ${data.msg}`); 
        }
    } catch (error) {
        console.error('Error en la petición de registro:', error);
        alert('Error al conectar con el servidor.');
    }
});