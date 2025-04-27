import styles from '../css/Monitoring.module.css'
import Out from './Out'
import In from './In'
import Break from './Break'

const EmployeeTracker = () => {
    return(
        <div className={styles.EmployeeTracker}>
                <table>
                    <tr>
                        <th>Employee Name</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                    </tr>
                    <tr>
                        <td>John Doe</td>
                        <td> <In /> </td>
                        <td>2025-04-27 10:30 AM</td>
                    </tr>
                    <tr>
                        <td>Jane Smith</td>
                        <td> <Out /> </td>
                        <td>2025-04-26 2:45 PM</td>
                    </tr>

                    <tr>
                        <td>Jane Smith</td>
                        <td> <Break /> </td>
                        <td>2025-04-26 2:45 PM</td>
                    </tr>
                </table>
        </div>
    )
}

export default EmployeeTracker;