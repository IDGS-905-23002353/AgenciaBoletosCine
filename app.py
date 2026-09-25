from flask import Flask, jsonify, request
from flask_cors import CORS 
import mysql.connector
import config
import os
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

app.config['JWT_SECRET_KEY'] = 'tu_clave_secreta_super_segura' 
jwt = JWTManager(app)

def obtener_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        user=os.getenv("DB_USER", "root"),
        password=config.DevelopmentConfig.SQLALCHEMY_DATABASE_URI.split("://")[1].split(":")[1].split("@")[0], # O puedes colocar directamente la contraseña
        database=os.getenv("DB_NAME", "cine")
    )

@app.route('/api/registro', methods=['POST'])
def registro():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    hashed_pw = generate_password_hash(password)
    
    conexion = obtener_db_connection()
    cursor = conexion.cursor()
    try:
        # Por defecto, todos los que se registran desde la web son 'cliente'
        cursor.execute("INSERT INTO usuarios (username, password_hash, rol) VALUES (%s, %s, 'cliente')", (username, hashed_pw))
        conexion.commit()
        return jsonify({"msg": "Usuario registrado exitosamente"}), 201
    except Exception as e:
        return jsonify({"msg": "El nombre de usuario ya existe"}), 400
    finally:
        cursor.close()
        conexion.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password_input = data.get('password')
    
    conexion = obtener_db_connection()
    cursor = conexion.cursor()
    try:
        # Ahora también traemos el 'rol' (user_data[3])
        cursor.execute("SELECT id, username, password_hash, rol FROM usuarios WHERE username = %s", (username,))
        user_data = cursor.fetchone()
    finally:
        cursor.close()
        conexion.close()
    
    if user_data and check_password_hash(user_data[2], password_input):
        # Guardamos el rol dentro del token
        identity_data = {
            'id': user_data[0], 
            'username': user_data[1], 
            'rol': user_data[3]
        }
        access_token = create_access_token(identity=identity_data)
        return jsonify(access_token=access_token), 200
    else:
        return jsonify({"msg": "Usuario o contraseña incorrectos"}), 401

#  Obtener y crear películas 
@app.route('/api/eventos', methods=['GET', 'POST'])
def gestionar_eventos():
    if request.method == 'POST':
        data = request.json
        titulo = data.get('titulo')
        descripcion = data.get('descripcion')
        precio = data.get('precio')
        imagen_base64 = data.get('imagen_base64', '')
        
        fecha = data.get('fecha')
        hora = data.get('hora')
        sala = data.get('sala')
        capacidad_maxima = data.get('capacidad_maxima', 50)
        
        conexion = obtener_db_connection() 
        cursor = conexion.cursor()
        try:
        
            cursor.execute(
                "INSERT INTO eventos (titulo, descripcion, precio, imagen_base64) VALUES (%s, %s, %s, %s)", 
                (titulo, descripcion, precio, imagen_base64)
            
            )
            evento_id = cursor.lastrowid # Obtenemos el ID generado de la película
            
          
            if fecha and hora and sala:
                cursor.execute(
                    "INSERT INTO horarios (evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos) VALUES (%s, %s, %s, %s, %s, 0)",
                    (evento_id, fecha, hora, sala, capacidad_maxima)
                )

            conexion.commit()
            return jsonify({"mensaje": "Película y función creada con éxito"}), 201
        except Exception as e:
            conexion.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
    else:
        conexion = obtener_db_connection()
        cursor = conexion.cursor(dictionary=True)
        try:
            cursor.execute("SELECT id, titulo, descripcion, precio, imagen_base64 FROM eventos")
            peliculas = cursor.fetchall()
            return jsonify(peliculas)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()

# Actualizar  y eliminar una película por ID
@app.route('/api/eventos/<int:id>', methods=['PUT', 'DELETE'])
def modificar_pelicula(id):
    if request.method == 'PUT':
        data = request.json
        titulo = data.get('titulo')
        descripcion = data.get('descripcion')
        precio = data.get('precio')
        imagen_base64 = data.get('imagen_base64')
        
        conexion = obtener_db_connection()
        cursor = conexion.cursor()
        try:
            if imagen_base64:
                cursor.execute(
                    "UPDATE eventos SET titulo = %s, descripcion = %s, precio = %s, imagen_base64 = %s WHERE id = %s",
                    (titulo, descripcion, precio, imagen_base64, id)
                )
            else:
                cursor.execute(
                    "UPDATE eventos SET titulo = %s, descripcion = %s, precio = %s WHERE id = %s",
                    (titulo, descripcion, precio, id)
                )
            conexion.commit()
            return jsonify({"mensaje": "Película actualizada con éxito"})
        except Exception as e:
            conexion.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
            
    elif request.method == 'DELETE':
        conexion = obtener_db_connection()
        cursor = conexion.cursor()
        try:
          
            cursor.execute("DELETE FROM horarios WHERE evento_id = %s", (id,))
         
            cursor.execute("DELETE FROM eventos WHERE id = %s", (id,))
            conexion.commit()
            return jsonify({"mensaje": "Película y sus funciones eliminadas con éxito"})
        except Exception as e:
            conexion.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()

#  Obtener los horarios/funciones de una película específica 
@app.route('/api/horarios/<int:evento_id>', methods=['GET'])
def get_horarios(evento_id):
    conexion = obtener_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        # cursor.execute(
        #     "SELECT id, evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos FROM horarios WHERE evento_id = %s", 
        #     (evento_id,)
        # )
        cursor.execute(
            """SELECT id, evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos,
                      CAST((SELECT COALESCE(SUM(a.cantidad), 0) FROM apartados a
                            WHERE a.horario_id = horarios.id AND a.expira_en > NOW()) AS SIGNED) AS boletos_apartados
               FROM horarios WHERE evento_id = %s""",
            (evento_id,)
        )

        horarios = cursor.fetchall()
        
        for h in horarios:
            if h.get('fecha'):
                h['fecha'] = h['fecha'].strftime('%Y-%m-%d')
                
        return jsonify(horarios)
    except Exception as e:
      
        return jsonify([])
    finally:
        cursor.close()
        conexion.close()

# Agregar un horario nuevo a una película existente (POST)
@app.route('/api/horarios', methods=['POST'])
def agregar_horario():
    data = request.json
    evento_id = data.get('evento_id')
    fecha = data.get('fecha')
    hora = data.get('hora')
    sala = data.get('sala')
    capacidad_maxima = data.get('capacidad_maxima', 50)
    
    conexion = obtener_db_connection()
    cursor = conexion.cursor()
    try:
        cursor.execute(
            "INSERT INTO horarios (evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos) VALUES (%s, %s, %s, %s, %s, 0)",
            (evento_id, fecha, hora, sala, capacidad_maxima)
        )
        conexion.commit()
        return jsonify({"mensaje": "Horario agregado con éxito"}), 201
    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

#  Actualizar un horario existente por su ID (PUT)
@app.route('/api/horarios/<int:horario_id>', methods=['PUT'])
def actualizar_horario(horario_id):
    data = request.json
    fecha = data.get('fecha')
    hora = data.get('hora')
    sala = data.get('sala')
    capacidad_maxima = data.get('capacidad_maxima')
    
    conexion = obtener_db_connection()
    cursor = conexion.cursor()
    try:
        cursor.execute(
            "UPDATE horarios SET fecha = %s, hora = %s, sala = %s, capacidad_maxima = %s WHERE id = %s",
            (fecha, hora, sala, capacidad_maxima, horario_id)
        )
        conexion.commit()
        return jsonify({"mensaje": "Horario actualizado con éxito"})
    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()
        
SEGUNDOS_APARTADO = 30

#  Apartar boletos por SEGUNDOS_APARTADO segundos (POST)
@app.route('/api/apartados', methods=['POST'])
def apartar_boletos():
    data = request.get_json()
    horario_id = data.get('horario_id')
    cantidad = int(data.get('cantidad_boletos', 1))

    conexion = obtener_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        # FOR UPDATE bloquea la función: dos personas no pueden apartar los mismos lugares al mismo tiempo
        cursor.execute(
            """SELECT capacidad_maxima, boletos_vendidos,
                      CAST((SELECT COALESCE(SUM(cantidad), 0) FROM apartados
                            WHERE horario_id = %s AND expira_en > NOW()) AS SIGNED) AS boletos_apartados
               FROM horarios WHERE id = %s FOR UPDATE""",
            (horario_id, horario_id)
        )
        horario = cursor.fetchone()

        if not horario:
            conexion.rollback()
            return jsonify({"error": "La función seleccionada no existe."}), 404

        disponibles = horario['capacidad_maxima'] - horario['boletos_vendidos'] - horario['boletos_apartados']

        if cantidad < 1 or cantidad > disponibles:
            conexion.rollback()
            return jsonify({"error": f"Lo sentimos, solo quedan {disponibles} boletos disponibles para esta función."}), 400

        cursor.execute(
            "INSERT INTO apartados (horario_id, cantidad, expira_en) VALUES (%s, %s, DATE_ADD(NOW(), INTERVAL %s SECOND))",
            (horario_id, cantidad, SEGUNDOS_APARTADO)
        )
        conexion.commit()
        return jsonify({"apartado_id": cursor.lastrowid, "segundos": SEGUNDOS_APARTADO}), 201
    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

#  Registrar una reserva de boletos (POST)
@app.route('/api/reservas', methods=['POST'])
def crear_reserva():
    data = request.get_json()
    apartado_id = data.get('apartado_id')

    conexion = obtener_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        # Solo se puede confirmar un apartado que siga vigente
        cursor.execute(
            "SELECT horario_id, cantidad FROM apartados WHERE id = %s AND expira_en > NOW() FOR UPDATE",
            (apartado_id,)
        )
        apartado = cursor.fetchone()

        if not apartado:
            conexion.rollback()
            return jsonify({"error": "Tu apartado expiró, los boletos volvieron a quedar disponibles."}), 410

        cursor.execute(
            "UPDATE horarios SET boletos_vendidos = boletos_vendidos + %s WHERE id = %s",
            (apartado['cantidad'], apartado['horario_id'])
        )
        cursor.execute("DELETE FROM apartados WHERE id = %s", (apartado_id,))

        conexion.commit()
        return jsonify({"mensaje": "¡Boleto(s) reservado(s) y descontado(s) con éxito!"}), 201

    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)